// One-time codes for signing in (purpose "login") and for confirming an email added to an account ("add_email").
// Codes: 6 random digits, stored only as a keyed hash, 5 minutes, one use, 5 wrong tries, 30 s between codes,
// at most 5 an hour and 10 a day per phone/email. A code that could not be delivered is deleted again.
// The code is shown back to the app only in development, or for the team's own TEST_LOGIN_TARGETS in test mode.
import { one, query } from '../db.js';
import { config, isPublicProduction } from '../config.js';
import { HttpError, tooMany } from '../lib/errors.js';
import { hashCode, normalizeEmail, normalizePhone, randomOtp } from '../lib/auth.js';
import { sendOtp } from '../providers/sms.js';
import { securityLog, clientIp } from '../lib/log.js';

const normTarget = (t) => normalizePhone(t) || normalizeEmail(t);
/** The team's own numbers / emails allowed to use test mode in the cloud (TEST_LOGIN_TARGETS). */
export const isTestTarget = (target) => !!target && config.testLoginTargets.some((t) => normTarget(t) === target);
/** The store reviewers' fixed number (REVIEW_PHONE + REVIEW_CODE), or null when not set up. */
export const reviewTarget = () => (config.reviewPhone && config.reviewCode ? normalizePhone(config.reviewPhone) : null);
export const isReview = (target) => !!target && target === reviewTarget();
/** Codes really reach the person only through a real provider (not the server log). */
export const realDelivery = (channel) => (channel === 'email' ? config.emailProvider !== 'console' : config.smsProvider !== 'console');
// never on a public server (the start-up check also refuses OTP_DEV_ECHO there)
const echoAllowed = (target) => !isPublicProduction && config.otpDevEcho && (config.isDev || isTestTarget(target));

/** Phone codes are off until SMS (MSG91 + DLT) is live, except for the reviewer number and the team's test numbers. */
export function assertChannelOpen(target, channel) {
  if (channel !== 'phone' || config.phoneLogin || isReview(target) || isTestTarget(target)) return;
  throw new HttpError(403, "Sign-in with a phone number isn't available yet. Please use your email address.", 'phone_login_off');
}

export async function issueCode({ target, channel, purpose = 'login', userId = null, req }) {
  const review = purpose === 'login' && isReview(target); // reviewer number: fixed code, nothing sent, no waits
  if (!review) {
    const recent = await one(
      `SELECT MAX(created_at) AS last,
              SUM(CASE WHEN created_at > DATEADD(HOUR, -1, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS hour,
              COUNT(*) AS day
         FROM otp_codes WHERE target=$1 AND created_at > DATEADD(DAY, -1, SYSDATETIMEOFFSET())`, [target]);
    if (recent?.last && Date.now() - new Date(recent.last).getTime() < config.otp.resendCooldownSeconds * 1000) {
      throw tooMany(`Please wait ${config.otp.resendCooldownSeconds} seconds before requesting another code`);
    }
    if (Number(recent?.hour || 0) >= config.otp.maxPerHour || Number(recent?.day || 0) >= config.otp.maxPerDay) {
      securityLog('otp_limit', { channel, ip: clientIp(req) });
      throw tooMany('Too many codes were requested for this address. Please try again later.');
    }
  }
  const code = review ? config.reviewCode : randomOtp();
  const row = await one(
    `INSERT INTO otp_codes (target, channel, code_hash, expires_at, purpose, user_id) OUTPUT INSERTED.id
       VALUES ($1, $2, $3, DATEADD(SECOND, $4, SYSDATETIMEOFFSET()), $5, $6)`,
    [target, channel, hashCode(target, code), config.otp.ttlSeconds, purpose, userId],
  );
  if (!review) {
    try { await sendOtp({ target, channel, code }); } catch (e) {
      await query('DELETE FROM otp_codes WHERE id=$1', [row.id]).catch(() => {}); // no wait, no count for a failed send
      securityLog('otp_delivery_failed', { channel, ip: clientIp(req), error: String(e.message || e).slice(0, 120) });
      throw new HttpError(503, channel === 'email'
        ? "We couldn't send the email right now. Please try again in a minute."
        : "We couldn't send the SMS right now. Please try again in a minute.", 'otp_not_sent');
    }
  }
  securityLog('otp_requested', { channel, purpose, ip: clientIp(req) });
  return { expiresIn: config.otp.ttlSeconds, ...(echoAllowed(target) ? { devCode: code } : {}) };
}

/** Checks a code inside a transaction. Returns { ok } or { error } (errors are returned so the try counter commits). */
export async function checkCode(c, { target, code, purpose = 'login', userId = null }) {
  const otp = (await c.query(
    `SELECT TOP 1 * FROM otp_codes WITH (UPDLOCK, ROWLOCK)
      WHERE target=$1 AND purpose=$2 AND consumed_at IS NULL AND ($3 IS NULL OR user_id=$3) ORDER BY created_at DESC`,
    [target, purpose, userId],
  )).rows[0];
  if (!otp || new Date(otp.expires_at) < new Date()) return { error: new HttpError(400, 'Code expired. Request a new one', 'otp_expired') };
  if (otp.attempts >= config.otp.maxAttempts) return { error: tooMany('Too many wrong attempts. Request a new code') };
  if (otp.code_hash !== hashCode(target, code)) {
    await c.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [otp.id]);
    return { error: new HttpError(400, 'Wrong code', 'otp_wrong') };
  }
  await c.query('UPDATE otp_codes SET consumed_at = SYSDATETIMEOFFSET() WHERE id=$1', [otp.id]);
  return { ok: true };
}
