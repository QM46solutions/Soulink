// Copyright notices and takedowns. Follows Instagram/Facebook's process, within India's law:
//  1. The rights owner (or their authorised agent) files a report: who they are, the work, where it is on Soulink,
//     and signed statements (good faith, accuracy, an undertaking to sue within 21 days: Copyright Rules 2013 Rule 75).
//  2. The Soulink team reviews it within 36 hours, the limit in Rule 75 (a reminder goes out at 24 hours). If valid, the Spark/post is taken down and
//     viewers see "unavailable because of a copyright complaint".
//  3. The uploader is told why, with the reporter's name and email (as Instagram does), and can contest.
//  4. Rule 75: if the uploader contests and the reporter does not bring a court order within 21 days, it comes back.
//  5. Repeat infringers (Meta's graduated steps): 1 strike = warning, 2 = no new posts for 7 days,
//     3 within a year = account removed. Strikes last 1 year; a restored post removes its strike.
import { many, one, query } from '../db.js';
import { audit } from './audit.js';
import { sendEmail } from '../providers/email.js';
import { pushTo } from './push.js';
import { banAccount } from './lifecycle.js';

export const DECIDE_HOURS = 36; // Copyright Rules 2013, Rule 75
export const REMIND_HOURS = 24; // reminder to the team: 12 hours left
export const RESTORE_DAYS = 21;
export const STRIKE_DAYS = 365;
export const BLOCK_DAYS = 7;
export const COPYRIGHT_EMAIL = process.env.COPYRIGHT_EMAIL || 'Rragishetty@gmail.com';
export const UNAVAILABLE = 'This is unavailable because of a copyright complaint.';

const TABLE = { spark: 'sparks', post: 'posts' };
const day = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
const sign = '\n\nSoulink Copyright Team · QM46 Solutions Private Limited · ' + COPYRIGHT_EMAIL;
const mail = (to, subject, text) => (to ? sendEmail({ to, subject, text: text + sign }).catch(() => {}) : null);

/** Finds the Spark or post a link points to: https://…/spark/<id> or /post/<id>. */
export function parseContentUrl(url) {
  const m = String(url || '').match(/\/(spark|post)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? { kind: m[1].toLowerCase(), id: m[2].toLowerCase() } : null;
}

export async function findContent(kind, id) {
  return one(`SELECT id, author_id, suspended_at, suspended_reason FROM ${TABLE[kind]} WHERE id=$1 AND deleted_at IS NULL`, [id]);
}

export async function fileReport(d, req) {
  const content = await findContent(d.kind, d.id);
  if (!content) return null;
  const r = await one(`INSERT INTO copyright_reports (reporter_name, reporter_email, reporter_phone, reporter_address, relationship, rights_owner,
      work_description, original_url, ownership_proof, content_kind, content_id, uploader_id, explanation, good_faith, accurate, suit_undertaking, signature)
    OUTPUT INSERTED.* VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,1,1,$14)`,
  [d.name, d.email, d.phone || null, d.address, d.relationship, d.rightsOwner, d.work, d.originalUrl || null, d.proof || null,
    d.kind, d.id, content.author_id, d.explanation || null, d.signature]);
  await audit(req, 'copyright_report', { actorId: null, targetUserId: content.author_id, detail: `${r.id} ${d.kind}:${d.id} by ${d.email}` });
  mail(d.email, `We received your copyright report (${String(r.id).slice(0, 8)})`, `Hi ${d.name},\n\nWe received your copyright report about a ${d.kind} on Soulink. Our team reviews every report within ${DECIDE_HOURS} hours and will email you the outcome.\n\nIf we remove the content, we tell the person who posted it, including your name and email, so they can contact you. If they contest the removal, the content may be restored after ${RESTORE_DAYS} days unless you send us a court order, as India's Copyright Rules 2013 provide.`);
  mail(COPYRIGHT_EMAIL, `New copyright report: decide by ${new Date(Date.now() + DECIDE_HOURS * 3600_000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, `${d.name} (${d.email}) reports ${d.kind} ${d.id}.\nWork: ${d.work}\nOwner: ${d.rightsOwner} (${d.relationship})\n\nReview it in the app: Settings › Copyright reports.`);
  return r;
}

async function strikes(userId) {
  const r = await one(`SELECT COUNT(*) AS n FROM copyright_strikes WHERE user_id=$1 AND removed_at IS NULL AND created_at > DATEADD(DAY, -${STRIKE_DAYS}, SYSDATETIMEOFFSET())`, [userId]);
  return Number(r?.n || 0);
}

/** The Soulink team's decision on a report. action: remove | reject | restore | court_order */
export async function decide(report, action, note, req) {
  const tbl = TABLE[report.content_kind];
  const uploader = report.uploader_id ? await one('SELECT * FROM users WHERE id=$1', [report.uploader_id]) : null;
  const what = report.content_kind === 'spark' ? 'Spark' : 'post';
  if (action === 'remove') {
    await query(`UPDATE ${tbl} SET suspended_at=COALESCE(suspended_at, SYSDATETIMEOFFSET()), suspended_reason=N'copyright' WHERE id=$1`, [report.content_id]);
    await query(`UPDATE copyright_reports SET status=N'removed', decided_at=SYSDATETIMEOFFSET(), decided_by=$2, decision_note=$3, restore_after=DATEADD(DAY, ${RESTORE_DAYS}, SYSDATETIMEOFFSET()) WHERE id=$1`, [report.id, req?.user?.id || null, note || null]);
    let n = 0;
    if (uploader) {
      await query('INSERT INTO copyright_strikes (user_id, report_id) VALUES ($1, $2)', [uploader.id, report.id]);
      n = await strikes(uploader.id);
      const step = n >= 3 ? 'Because this is your third copyright strike in a year, your account has been removed.'
        : n === 2 ? `This is your second copyright strike in a year, so you can't post new Sparks, posts or Moments for ${BLOCK_DAYS} days. A third strike removes your account.`
          : 'This is a warning. Strikes last 1 year; 3 strikes in a year remove your account.';
      if (n === 2) await query(`UPDATE users SET posting_blocked_until=DATEADD(DAY, ${BLOCK_DAYS}, SYSDATETIMEOFFSET()) WHERE id=$1`, [uploader.id]);
      const text = `Your ${what} was removed after a copyright complaint from ${report.reporter_name} (${report.reporter_email}), on behalf of ${report.rights_owner}.\n\nWork they say you used: ${report.work_description}\n\n${step}\n\nWhat you can do:\n• Contact them directly to sort it out; they can withdraw the complaint.\n• If you own the rights, have permission, or the use is allowed by law (for example fair dealing under section 52 of the Copyright Act), contest it in Settings › Account status. If they don't send us a court order within ${RESTORE_DAYS} days, your ${what} comes back.`;
      await pushTo(uploader.id, 'account', { title: 'Copyright notice', body: `Your ${what} was removed after a copyright complaint. Tap to see why.`, url: '/settings/status', tag: 'copyright' });
      mail(uploader.email, `Your ${what} was removed after a copyright complaint`, `Hi${uploader.username ? ` @${uploader.username}` : ''},\n\n${text}`);
      mail(report.reporter_email, 'We removed the content you reported', `Hi ${report.reporter_name},\n\nWe removed the ${what} you reported and told the person who posted it, including your name and email.\n\nIf they contest, it will be restored after ${RESTORE_DAYS} days (on ${day(Date.now() + RESTORE_DAYS * 86400_000)}) unless you send a court order to ${COPYRIGHT_EMAIL}, as Rule 75 of the Copyright Rules 2013 provides.`);
    }
    await audit(req, 'copyright_removed', { targetUserId: uploader?.id, detail: `${report.id} strikes=${n}` });
    if (uploader && n >= 3) await banAccount(uploader, { reason: 'Repeated copyright infringement: 3 strikes in a year' }, req);
    return { strikes: n };
  }
  if (action === 'reject') {
    await query(`UPDATE copyright_reports SET status=N'rejected', decided_at=SYSDATETIMEOFFSET(), decided_by=$2, decision_note=$3 WHERE id=$1`, [report.id, req?.user?.id || null, note || null]);
    mail(report.reporter_email, 'About your copyright report', `Hi ${report.reporter_name},\n\nWe reviewed your report and did not remove the content${note ? `: ${note}` : '.'}\n\nYou can reply to this email with more information, or approach a court.`);
    await audit(req, 'copyright_rejected', { detail: report.id });
    return {};
  }
  if (action === 'restore') { await restore(report, req, note); return {}; }
  if (action === 'court_order') {
    await query(`UPDATE copyright_reports SET status=N'court_order', court_order_at=SYSDATETIMEOFFSET(), decision_note=COALESCE($2, decision_note) WHERE id=$1`, [report.id, note || null]);
    await audit(req, 'copyright_court_order', { detail: report.id });
    if (uploader) mail(uploader.email, `Your ${what} stays removed`, `The copyright owner sent us a court order, so your ${what} stays removed.`);
    return {};
  }
  throw new Error('unknown action');
}

async function restore(report, req, note) {
  await query(`UPDATE ${TABLE[report.content_kind]} SET suspended_at=NULL, suspended_reason=NULL WHERE id=$1 AND suspended_reason=N'copyright'`, [report.content_id]);
  await query(`UPDATE copyright_reports SET status=N'restored', decision_note=COALESCE($2, decision_note) WHERE id=$1`, [report.id, note || null]);
  await query('UPDATE copyright_strikes SET removed_at=SYSDATETIMEOFFSET() WHERE report_id=$1 AND removed_at IS NULL', [report.id]);
  const uploader = report.uploader_id ? await one('SELECT email, username FROM users WHERE id=$1', [report.uploader_id]) : null;
  const what = report.content_kind === 'spark' ? 'Spark' : 'post';
  if (uploader) mail(uploader.email, `Your ${what} is back`, `Your ${what} has been restored and the copyright strike removed.`);
  mail(report.reporter_email, 'Content restored', `The ${what} you reported has been restored: the person who posted it contested the removal and no court order reached us within ${RESTORE_DAYS} days.`);
  await audit(req, 'copyright_restored', { targetUserId: report.uploader_id, detail: report.id });
}

/** The uploader contests a removal. */
export async function appeal(report, text, req) {
  await query('UPDATE copyright_reports SET appeal_text=$2, appealed_at=SYSDATETIMEOFFSET() WHERE id=$1', [report.id, text]);
  await audit(req, 'copyright_appeal', { detail: report.id });
  mail(report.reporter_email, 'The person you reported contested the removal', `Hi ${report.reporter_name},\n\nThe person who posted the content contested your copyright report. Their reason:\n"${text}"\n\nThe content will be restored on ${day(report.restore_after)} unless you send a court order to ${COPYRIGHT_EMAIL} before then.`);
  mail(COPYRIGHT_EMAIL, 'Copyright removal contested', `Report ${report.id} was contested. Restores on ${day(report.restore_after)} unless a court order arrives.`);
}

/** Hourly: reports still waiting after 24 hours get a reminder (12 hours left of the 36). */
export async function remindPendingReports() {
  try {
    const due = await many(`SELECT id, reporter_name, content_kind, created_at FROM copyright_reports WHERE status=N'received' AND reminded_at IS NULL AND created_at < DATEADD(HOUR, -${REMIND_HOURS}, SYSDATETIMEOFFSET())`);
    for (const r of due) {
      await query('UPDATE copyright_reports SET reminded_at=SYSDATETIMEOFFSET() WHERE id=$1', [r.id]);
      mail(COPYRIGHT_EMAIL, `Reminder: copyright report due in ${DECIDE_HOURS - REMIND_HOURS} hours`, `The report from ${r.reporter_name} about a ${r.content_kind} must be decided by ${new Date(new Date(r.created_at).getTime() + DECIDE_HOURS * 3600_000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST), the 36-hour limit in Rule 75.\n\nReview it in the app: Settings › Copyright reports.`);
    }
    return due.length;
  } catch { return 0; }
}

/** Hourly: contested removals with no court order after 21 days come back (Rule 75). */
export async function runCopyrightRestores() {
  try {
    const due = await many(`SELECT * FROM copyright_reports WHERE status=N'removed' AND appealed_at IS NOT NULL AND court_order_at IS NULL AND restore_after < SYSDATETIMEOFFSET()`);
    for (const r of due) await restore(r, null, 'Restored after 21 days without a court order').catch(() => {});
    return due.length;
  } catch { return 0; }
}

/** Second strike: no new posts for 7 days. Returns a message, or null when posting is allowed. */
export function postingBlocked(user) {
  if (!user?.posting_blocked_until || new Date(user.posting_blocked_until) < new Date()) return null;
  return `Because of copyright strikes you can't post until ${day(user.posting_blocked_until)}.`;
}

export const reportView = (r, forUploader = false) => ({
  id: r.id, status: r.status, kind: r.content_kind, contentId: r.content_id, createdAt: r.created_at, decidedAt: r.decided_at,
  restoreAfter: r.restore_after, appealed: !!r.appealed_at, work: r.work_description, rightsOwner: r.rights_owner,
  reporter: { name: r.reporter_name, email: r.reporter_email }, // shared with the uploader, as Instagram does
  ...(forUploader ? {} : { relationship: r.relationship, phone: r.reporter_phone, address: r.reporter_address, originalUrl: r.original_url, proof: r.ownership_proof, explanation: r.explanation, signature: r.signature, appealText: r.appeal_text, note: r.decision_note, uploaderId: r.uploader_id }),
});
