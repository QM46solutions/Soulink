// Audit trail (policy sections 4 and 8): logins, logouts, admin actions, data downloads, account deletion.
// Written to audit_log (kept 365 days) and to the security log.
import { query } from '../db.js';
import { clientIp, securityLog } from '../lib/log.js';

export const AUDIT_KEEP_DAYS = 365;

export async function audit(req, action, { actorId, targetUserId, detail } = {}) {
  const actor = actorId !== undefined ? actorId : req?.user?.id || null;
  const ip = clientIp(req);
  securityLog(action, { actor, target: targetUserId || null, detail: detail || undefined, ip });
  try {
    await query('INSERT INTO audit_log (actor_id, action, target_user_id, detail, ip) VALUES ($1, $2, $3, $4, $5)',
      [actor, String(action).slice(0, 60), targetUserId || null, detail ? String(detail).slice(0, 1000) : null, ip]);
  } catch { /* the security log line above still has it */ }
}

export async function purgeAuditLog() {
  try { await query(`DELETE FROM audit_log WHERE created_at < DATEADD(DAY, -${AUDIT_KEEP_DAYS}, SYSDATETIMEOFFSET())`); } catch { /* next run */ }
  // ended sessions are only needed for a short while ("session ended" message)
  try { await query('DELETE FROM user_sessions WHERE revoked_at < DATEADD(DAY, -30, SYSDATETIMEOFFSET()) OR last_seen_at < DATEADD(DAY, -60, SYSDATETIMEOFFSET())'); } catch { /* next run */ }
}
