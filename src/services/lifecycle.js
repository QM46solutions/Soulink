// Account lifecycle (Privacy Policy "Pausing and deleting"; Information Security Policy section 11):
//  pause            hidden everywhere, data kept, logging in again brings it back
//  schedule delete  hidden at once, erased after 30 days; logging in before then cancels
//  delete           erased; a 1-year identity record is kept (name, date of birth, city, phone, email, consents)
//  ban              repeat offenders: name, contact and an encrypted face fingerprint kept (3 years by default)
//                   so the same person cannot create a new profile
import { many, one, query } from '../db.js';
import { config } from '../config.js';
import { deleteAccount } from './account.js';
import { endAllSessions } from './sessions.js';
import { audit } from './audit.js';
import { signOutEverywhere } from '../realtime.js';
import { sendEmail } from '../providers/email.js';
import { sendSmsNotice } from '../providers/sms.js';
import { openFace, sealFace } from '../lib/faceCrypto.js';
import { faceDistance } from './faceEngine.js';

export const DELETE_GRACE_DAYS = 30;
export const BAN_DAYS = 3 * 365;
export const MESSAGES = {
  paused: 'This account is paused. Log in again to reactivate it.',
  deleting: `Your account will be deleted in ${DELETE_GRACE_DAYS} days. Log in before then to cancel.`,
  banned: "This Soulink account was removed for breaking our rules, and a new one can't be created. If you think this is a mistake, write to our Grievance Officer.",
};

const day = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
const GRIEVANCE = 'Rragishetty@gmail.com';

function notify(u, subject, text, smsTemplateEnv) {
  if (u.email) return sendEmail({ to: u.email, subject, text: `${text}\n\nSoulink · QM46 Solutions Private Limited · Grievance Officer: ${GRIEVANCE}` }).catch(() => {});
  if (u.phone && smsTemplateEnv) return sendSmsNotice(u.phone, smsTemplateEnv).catch(() => {});
  return null;
}

async function signOutAll(u, req, event) {
  await endAllSessions(u.id);
  signOutEverywhere(u.id, req?.sessionId, event);
}

export async function pauseAccount(u, req) {
  await query("UPDATE users SET deactivated_at=SYSDATETIMEOFFSET(), deactivate_reason=N'paused', delete_after=NULL WHERE id=$1", [u.id]);
  await audit(req, 'account_paused', { targetUserId: u.id });
  await signOutAll(u, req, 'account:paused');
  notify(u, 'Your Soulink account is paused', `Your Soulink account is paused. Nobody can see your profile, posts or Sparks, and you won't get notifications.\n\nYour data is kept safe. Log in any time to reactivate your account.`);
}

export async function scheduleDeletion(u, req) {
  const after = new Date(Date.now() + DELETE_GRACE_DAYS * 86400_000);
  await query("UPDATE users SET deactivated_at=SYSDATETIMEOFFSET(), deactivate_reason=N'deleting', delete_after=$2 WHERE id=$1", [u.id, after]);
  await audit(req, 'deletion_scheduled', { targetUserId: u.id, detail: after.toISOString() });
  await signOutAll(u, req, 'account:deleting');
  notify(u, 'Your Soulink account will be deleted', `Your account will be deleted in ${DELETE_GRACE_DAYS} days, on ${day(after)}. Log in before then to cancel.\n\nUntil then your profile is hidden from everyone. If you want a copy of your data, log in and use Settings › Download my data before that date.`, 'MSG91_DELETION_SCHEDULED_TEMPLATE_ID');
  return after;
}

/** At login: a paused account, or one waiting to be deleted, comes back. Returns 'paused' | 'deleting' | null. */
export async function reactivateOnLogin(u, req) {
  if (!u.deactivated_at) return null;
  const was = u.deactivate_reason === 'deleting' ? 'deleting' : 'paused';
  await query('UPDATE users SET deactivated_at=NULL, deactivate_reason=NULL, delete_after=NULL WHERE id=$1', [u.id]);
  await audit(req, was === 'deleting' ? 'deletion_cancelled' : 'account_reactivated', { actorId: u.id, targetUserId: u.id });
  if (was === 'deleting') notify(u, 'Your Soulink account will not be deleted', 'You logged in, so your account deletion is cancelled. Everything is back as it was.');
  return was;
}

/** Erase now (also used at the end of the 30 days). The 1-year identity record is kept by deleteAccount. */
export async function eraseAccount(u, req, reason = 'user') {
  await signOutAll(u, req, 'account:deleted');
  await deleteAccount(u.id, reason);
  await audit(req, 'account_deleted', { actorId: req?.user?.id ?? null, targetUserId: u.id, detail: `${reason}${u.username ? ` @${u.username}` : ''}` });
  notify(u, 'Your Soulink account has been deleted', `Your Soulink account${u.username ? ` @${u.username}` : ''} was deleted on ${day(Date.now())}. You have been logged out on every phone and browser.\n\nYour profile, photos, face data, Soul DNA, posts, Sparks and chats have been erased. As Indian law requires, we keep your name, date of birth, city, phone number, email and consent records for 1 year, used only to answer lawful requests, then delete them.\n\nIf you did not do this, write to our Grievance Officer.`, 'MSG91_ACCOUNT_DELETED_TEMPLATE_ID');
}

/** Daily: erase accounts whose 30 days are over. */
export async function runScheduledDeletions() {
  try {
    const due = await many('SELECT * FROM users WHERE delete_after IS NOT NULL AND delete_after < SYSDATETIMEOFFSET()');
    for (const u of due) await eraseAccount(u, null, 'scheduled').catch(() => {});
    return due.length;
  } catch { return 0; }
}

// ---------- bans ----------
const active = 'lifted_at IS NULL AND expires_at > SYSDATETIMEOFFSET()';

export async function banAccount(u, { reason, days = BAN_DAYS }, req) {
  const face = await one('SELECT embedding FROM face_embeddings WHERE user_id=$1', [u.id]);
  const vec = openFace(face?.embedding);
  await query(`INSERT INTO banned_identities (user_id, username, display_name, phone, email, face_embedding, reason, banned_by, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, DATEADD(DAY, $9, SYSDATETIMEOFFSET()))`,
  [u.id, u.username, u.display_name, u.phone, u.email, vec ? sealFace(vec) : null, reason, req?.user?.id || null, days]);
  await audit(req, 'account_banned', { targetUserId: u.id, detail: reason });
  await eraseAccount(u, req, 'banned');
}

/** Is this phone or email banned? */
export async function contactBanned({ phone, email }) {
  if (!phone && !email) return null;
  return one(`SELECT TOP 1 id, reason FROM banned_identities WHERE ${active} AND (phone=$1 OR email=$2)`, [phone || '#', email || '#']);
}

/** Does this face match a banned person? (checked at the face scan, before an account can finish sign-up) */
export async function faceBanned(vector, maxDistance) {
  const rows = await many(`SELECT id, face_embedding FROM banned_identities WHERE ${active} AND face_embedding IS NOT NULL`);
  for (const r of rows) {
    const v = openFace(r.face_embedding);
    if (v && faceDistance(vector, v) < maxDistance) return r;
  }
  return null;
}

export async function purgeExpiredBans() {
  // expired bans: the face fingerprint is erased; the row stays 1 more year as part of the audit trail, then goes
  await query(`UPDATE banned_identities SET face_embedding=NULL WHERE face_embedding IS NOT NULL AND (lifted_at IS NOT NULL OR expires_at < SYSDATETIMEOFFSET())`).catch(() => {});
  await query('DELETE FROM banned_identities WHERE COALESCE(lifted_at, expires_at) < DATEADD(DAY, -365, SYSDATETIMEOFFSET())').catch(() => {});
}

void config;
