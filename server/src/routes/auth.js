import { Router } from 'express';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, notFound, tooMany, unauthorized, HttpError } from '../lib/errors.js';
import { hashCode, normalizeEmail, normalizePhone, randomOtp } from '../lib/auth.js';
import { startSession, endSession } from '../services/sessions.js';
import { audit } from '../services/audit.js';
import { securityLog, clientIp } from '../lib/log.js';
import { disconnectSession } from '../realtime.js';
import { contactBanned, reactivateOnLogin, MESSAGES } from '../services/lifecycle.js';
import { sendOtp } from '../providers/sms.js';
import { requireAuth } from '../middleware/auth.js';
import { meView } from '../services/social.js';
import { expireSignup, isExpiredSignup, isRealMember } from '../services/signupCleanup.js';

const r = Router();

const targetSchema = z
  .object({ phone: z.string().optional(), email: z.string().optional() })
  .refine((v) => !!v.phone !== !!v.email, 'Send either phone or email');

function resolveTarget(body) {
  const { phone, email } = targetSchema.parse(body);
  if (phone) {
    const p = normalizePhone(phone);
    if (!p) throw badRequest('Enter a valid mobile number', 'invalid_phone');
    return { target: p, channel: 'phone' };
  }
  const e = normalizeEmail(email);
  if (!e) throw badRequest('Enter a valid email address', 'invalid_email');
  return { target: e, channel: 'email' };
}

// Step 1: request a code
r.post(
  '/otp/request',
  ah(async (req, res) => {
    const { target, channel } = resolveTarget(req.body);
    // intent "login": only send a code if an account exists (the Log in screen shows a friendly message otherwise)
    const intent = z.enum(['login', 'signup']).optional().parse(req.body.intent);
    const col = channel === 'phone' ? 'phone' : 'email';
    const existing = await one(`SELECT TOP 1 id FROM users WHERE ${col}=$1`, [target]);
    if (!existing && await contactBanned(channel === 'phone' ? { phone: target } : { email: target })) {
      securityLog('signup_blocked_banned', { channel, ip: clientIp(req) });
      throw new HttpError(403, MESSAGES.banned, 'banned');
    }
    if (intent === 'login' && !existing) {
      throw notFound(channel === 'phone' ? 'No Soulink account uses this number yet.' : 'No Soulink account uses this email yet.', 'no_account');
    }
    const last = await one(`SELECT TOP 1 created_at FROM otp_codes WHERE target=$1 ORDER BY created_at DESC`, [target]);
    if (last && Date.now() - new Date(last.created_at).getTime() < config.otp.resendCooldownSeconds * 1000) {
      throw tooMany(`Please wait ${config.otp.resendCooldownSeconds} seconds before requesting another code`);
    }
    const code = randomOtp();
    await query(
      `INSERT INTO otp_codes (target, channel, code_hash, expires_at) VALUES ($1, $2, $3, DATEADD(SECOND, $4, SYSDATETIMEOFFSET()))`,
      [target, channel, hashCode(target, code), config.otp.ttlSeconds],
    );
    await sendOtp({ target, channel, code });
    securityLog('otp_requested', { channel, ip: clientIp(req) });
    res.json({ sent: true, target, channel, accountExists: !!existing, expiresIn: config.otp.ttlSeconds, ...((config.isDev || config.accessCode) && config.otpDevEcho ? { devCode: code } : {}) });
  }),
);

// Step 2: verify code → log in or create account
r.post(
  '/otp/verify',
  ah(async (req, res) => {
    const { target, channel } = resolveTarget(req.body);
    const code = z.string().regex(/^\d{6}$/, 'Code must be 6 digits').parse(req.body.code);

    const result = await tx(async (c) => {
      const otp = (await c.query(
        `SELECT TOP 1 * FROM otp_codes WITH (UPDLOCK, ROWLOCK) WHERE target=$1 AND consumed_at IS NULL ORDER BY created_at DESC`,
        [target],
      )).rows[0];
      if (!otp || new Date(otp.expires_at) < new Date()) return { error: badRequest('Code expired. Request a new one', 'otp_expired') };
      if (otp.attempts >= config.otp.maxAttempts) return { error: tooMany('Too many wrong attempts. Request a new code') };
      if (otp.code_hash !== hashCode(target, code)) {
        await c.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [otp.id]);
        return { error: badRequest('Wrong code', 'otp_wrong') };
      }
      await c.query('UPDATE otp_codes SET consumed_at = SYSDATETIMEOFFSET() WHERE id=$1', [otp.id]);

      const col = channel === 'phone' ? 'phone' : 'email';
      let user = (await c.query(`SELECT * FROM users WHERE ${col}=$1`, [target])).rows[0];
      let isNew = false;
      if (!user) {
        user = (await c.query(`INSERT INTO users (${col}) OUTPUT INSERTED.* VALUES ($1)`, [target])).rows[0];
        isNew = true;
      }
      return { user, isNew };
    });
    // Errors are returned (not thrown) so the attempt counter update is committed.
    if (result.error) { securityLog('login_failed', { channel, reason: result.error.code, ip: clientIp(req) }); throw result.error; }

    // came back more than an hour after leaving a sign-up unfinished: that half-made account is cleared and they
    // start again as a brand-new user
    if (!result.isNew && isExpiredSignup(result.user) && !(await isRealMember(result.user.id))) {
      await expireSignup(result.user);
      const col = channel === 'phone' ? 'phone' : 'email';
      result.user = await one(`INSERT INTO users (${col}) OUTPUT INSERTED.* VALUES ($1)`, [target]);
      result.isNew = true;
    }
    const welcomeBack = await reactivateOnLogin(result.user, req); // paused or waiting to be deleted → back
    const token = await startSession(result.user.id, req);
    await audit(req, result.isNew ? 'signup' : 'login', { actorId: result.user.id, detail: channel });
    res.json({ token, isNew: result.isNew, ...(welcomeBack ? { welcomeBack } : {}), user: meView(welcomeBack ? { ...result.user, deactivated_at: null } : result.user) });
  }),
);

// Log out: ends this device's session only. Other devices stay logged in.
r.post(
  '/logout',
  requireAuth,
  ah(async (req, res) => {
    if (req.sessionId) { await endSession(req.sessionId); disconnectSession(req.sessionId); }
    await audit(req, 'logout');
    res.json({ ok: true });
  }),
);

// Google / Apple sign-in need real OAuth client IDs → wired at the cloud move (Milestone 7).
r.post('/google', (req, res, next) => next(new HttpError(501, 'Google sign-in will be enabled with the cloud setup', 'not_implemented')));
r.post('/apple', (req, res, next) => next(new HttpError(501, 'Apple sign-in will be enabled with the cloud setup', 'not_implemented')));

r.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    if (!req.user) throw unauthorized();
    res.json({ user: meView(req.user) });
  }),
);

export default r;
