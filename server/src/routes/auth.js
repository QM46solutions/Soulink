import { Router } from 'express';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, notFound, tooMany, unauthorized, HttpError } from '../lib/errors.js';
import { normalizeEmail, normalizePhone } from '../lib/auth.js';
import { startSession, endSession } from '../services/sessions.js';
import { assertChannelOpen, checkCode, isReview, issueCode, realDelivery } from '../services/otp.js';
import { audit } from '../services/audit.js';
import { securityLog, clientIp } from '../lib/log.js';
import { disconnectSession } from '../realtime.js';
import { blockedMessage, contactBanned, reactivateOnLogin, MESSAGES } from '../services/lifecycle.js';
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

// Which sign-in codes are on, so the app can offer the phone first once SMS is live (email stays the fallback)
r.get('/options', (req, res) => res.json({ phone: !!config.phoneLogin, email: true }));

// Step 1: request a code. The same answer whether or not an account exists (no one can test which emails or
// numbers are on Soulink); after the code, a new person is taken to sign-up and a returning one to Home.
r.post(
  '/otp/request',
  ah(async (req, res) => {
    const { target, channel } = resolveTarget(req.body);
    z.enum(['login', 'signup']).optional().parse(req.body.intent); // older apps still send it; the answer is the same
    assertChannelOpen(target, channel);
    const col = channel === 'phone' ? 'phone' : 'email';
    const existing = await one(`SELECT TOP 1 id FROM users WHERE ${col}=$1`, [target]);
    const blocked = !existing && await contactBanned(channel === 'phone' ? { phone: target } : { email: target });
    if (blocked) {
      securityLog(blocked.kind === 'rejoin' ? 'signup_blocked_rejoin_wait' : 'signup_blocked_banned', { channel, ip: clientIp(req) });
      throw new HttpError(403, blockedMessage(blocked), blocked.kind === 'rejoin' ? 'rejoin_wait' : 'banned');
    }
    const sent = await issueCode({ target, channel, purpose: 'login', req });
    res.json({ sent: true, target, channel, ...sent });
  }),
);

// Step 2: verify code → log in or create account
r.post(
  '/otp/verify',
  ah(async (req, res) => {
    const { target, channel } = resolveTarget(req.body);
    const code = z.string().regex(/^\d{6}$/, 'Code must be 6 digits').parse(req.body.code);
    // the email / phone counts as verified only when the code really went there (not test mode, not the reviewer)
    const verifiedCol = realDelivery(channel) && !isReview(target) ? (channel === 'phone' ? 'phone_verified_at' : 'email_verified_at') : null;

    const result = await tx(async (c) => {
      const chk = await checkCode(c, { target, code, purpose: 'login' });
      if (chk.error) return chk;
      const col = channel === 'phone' ? 'phone' : 'email';
      let user = (await c.query(`SELECT * FROM users WHERE ${col}=$1`, [target])).rows[0];
      let isNew = false;
      if (!user) {
        user = (await c.query(`INSERT INTO users (${col}) OUTPUT INSERTED.* VALUES ($1)`, [target])).rows[0];
        isNew = true;
        // the store reviewers' account skips the live face scan (no face fingerprint is stored for it)
        if (isReview(target)) user = (await c.query('UPDATE users SET face_verified=1 OUTPUT INSERTED.* WHERE id=$1', [user.id])).rows[0];
      }
      if (verifiedCol) user = (await c.query(`UPDATE users SET ${verifiedCol} = COALESCE(${verifiedCol}, SYSDATETIMEOFFSET()) OUTPUT INSERTED.* WHERE id=$1`, [user.id])).rows[0];
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
      if (isReview(target)) result.user = await one('UPDATE users SET face_verified=1 OUTPUT INSERTED.* WHERE id=$1', [result.user.id]);
      if (verifiedCol) result.user = await one(`UPDATE users SET ${verifiedCol} = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1`, [result.user.id]);
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
