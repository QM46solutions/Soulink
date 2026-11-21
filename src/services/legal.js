// Grievance Officer complaints and lawful orders, with the deadlines Indian law sets.
//  - Complaints (IT Rules 2021, Rule 3(2), as amended): acknowledged at once by email, resolved within 7 days.
//    A complaint that content shows the complainant nude / in a sexual act, morphed, or impersonated: removed within 2 hours.
//  - DPDP Rules 2025: data-rights complaints (access, correction, erasure, consent) answered within 7 days here,
//    always inside the 90 days the Rules allow.
//  - Lawful orders (IT Act s.79(3)(b), IT Rules as amended Feb 2026): takedown within 3 hours, user information
//    within 72 hours, preservation at once (3 hours).
import { many, one, query } from '../db.js';
import { sendEmail } from '../providers/email.js';
import { audit } from './audit.js';
import { parseContentUrl } from './copyright.js';

export const GRIEVANCE_EMAIL = process.env.GRIEVANCE_EMAIL || 'quantum46solutions@gmail.com';
export const RESOLVE_DAYS = 7;
export const URGENT_HOURS = 2;
export const ORDER_HOURS = { takedown: 3, preserve: 3, info_request: 72 };
export const CATEGORIES = {
  intimate_or_impersonation: 'Nude, sexual, morphed or fake content of me, or someone pretending to be me',
  content: 'A post, Spark, comment or message breaks the rules or the law',
  account: 'My account (blocked, limited, removed, or a decision I disagree with)',
  privacy: 'My privacy or personal data',
  data_rights: 'See, correct or erase my data, or withdraw consent',
  ai_content: 'AI-made content (Soulmoji, Argue Referee, translation)',
  payment: 'A payment or refund',
  other: 'Something else',
};
const TABLE = { spark: 'sparks', post: 'posts' };
const ist = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const sign = '\n\nGrievance Officer, Soulink · QM46 Solutions Private Limited · ' + GRIEVANCE_EMAIL;
const mail = (to, subject, text) => (to ? sendEmail({ to, subject, text: text + sign }).catch(() => {}) : null);

export const grievanceView = (g) => ({
  id: g.id, ticket: g.ticket_no, name: g.name, email: g.email, phone: g.phone, category: g.category, categoryText: CATEGORIES[g.category] || g.category,
  aboutUrl: g.about_url, aboutUsername: g.about_username, details: g.details, status: g.status, urgent: !!g.urgent,
  dueAt: g.due_at, resolution: g.resolution, resolvedAt: g.resolved_at, handledBy: g.handled_by, createdAt: g.created_at, ackSentAt: g.ack_sent_at,
});

export async function fileGrievance(d, req) {
  const urgent = d.category === 'intimate_or_impersonation';
  const g = await one(`INSERT INTO grievances (user_id, name, email, phone, category, about_url, about_username, details, urgent, due_at, ack_sent_at)
    OUTPUT INSERTED.* VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ${urgent ? `DATEADD(HOUR, ${URGENT_HOURS}, SYSDATETIMEOFFSET())` : `DATEADD(DAY, ${RESOLVE_DAYS}, SYSDATETIMEOFFSET())`}, SYSDATETIMEOFFSET())`,
  [req?.user?.id || null, d.name, d.email, d.phone || null, d.category, d.aboutUrl || null, d.aboutUsername || null, d.details, urgent ? 1 : 0]);
  await audit(req, 'grievance_filed', { targetUserId: req?.user?.id || null, detail: `#${g.ticket_no} ${d.category}` });
  // the acknowledgement IS the 24-hour acknowledgement the Rules ask for: sent the moment it arrives
  mail(d.email, `We received your complaint (#${g.ticket_no})`, `Hi ${d.name},\n\nThis confirms that Soulink's Grievance Officer received your complaint #${g.ticket_no} on ${ist(g.created_at)} (IST).\n\n${urgent
    ? 'Because it is about intimate, morphed or impersonating content of you, we act on it within 2 hours.'
    : `We will look into it and reply with a decision by ${ist(g.due_at)} (within ${RESOLVE_DAYS} days).`}\n\nWhat you told us:\n${d.details}\n\nIf you are not satisfied with our decision, you can appeal to the Grievance Appellate Committee (gac.gov.in) for content decisions, or complain to the Data Protection Board of India about personal data.`);
  mail(GRIEVANCE_EMAIL, `${urgent ? 'URGENT (2 hours): ' : ''}Complaint #${g.ticket_no}: decide by ${ist(g.due_at)}`, `${d.name} <${d.email}> · ${CATEGORIES[d.category]}\n${d.aboutUrl || d.aboutUsername || ''}\n\n${d.details}\n\nHandle it in the console: Legal › Complaints.`);
  return g;
}

/** Suspends the Spark or post a link points to (a lawful order or an urgent complaint). Returns 1 if removed. */
export async function removeLinked(url, reason = 'legal') {
  const t = parseContentUrl(url);
  if (!t) return 0;
  const r = await query(`UPDATE ${TABLE[t.kind]} SET suspended_at=COALESCE(suspended_at, SYSDATETIMEOFFSET()), suspended_reason=$2 WHERE id=$1 AND deleted_at IS NULL`, [t.id, reason]);
  const n = Number(r?.rowCount || 0);
  // IT Rules 2021: the person who posted it is told what was removed, why, and how to ask for a review
  if (n) {
    const a = await one(`SELECT u.email, u.username FROM ${TABLE[t.kind]} c JOIN users u ON u.id = c.author_id WHERE c.id=$1`, [t.id]).catch(() => null);
    mail(a?.email, `Your ${t.kind === 'spark' ? 'Spark' : 'post'} was removed`, `Hi ${a?.username ? '@' + a.username : ''},\n\nWe removed one of your ${t.kind === 'spark' ? 'Sparks' : 'posts'} ${reason === 'legal' ? 'because of an order from a court or government authority, as Indian law requires' : 'after a complaint to our Grievance Officer showed it breaks our Community Guidelines or the law'}. Only you can still see it.\n\nIf you think this is a mistake, reply to this email within 30 days and we will review it.`);
  }
  return n;
}

export async function updateGrievance(g, { status, resolution, removeContent }, req) {
  let removed = 0;
  if (removeContent && g.about_url) removed = await removeLinked(g.about_url, 'complaint');
  const closing = ['resolved', 'rejected'].includes(status);
  await query(`UPDATE grievances SET status=$2, resolution=COALESCE($3, resolution), handled_by=$4, resolved_at=${closing ? 'SYSDATETIMEOFFSET()' : 'resolved_at'} WHERE id=$1`,
    [g.id, status, resolution || null, req?.cu?.name || null]);
  await audit(req, 'grievance_' + status, { actorId: null, detail: `#${g.ticket_no} by ${req?.cu?.name || 'team'}${removed ? ' (content removed)' : ''}` });
  if (closing) {
    mail(g.email, `Decision on your complaint (#${g.ticket_no})`, `Hi ${g.name},\n\n${status === 'resolved' ? 'We have acted on your complaint.' : 'We looked into your complaint and decided not to take action.'}\n\n${resolution || ''}\n\nIf you are not satisfied, you can appeal to the Grievance Appellate Committee (gac.gov.in) within 30 days for content decisions, or complain to the Data Protection Board of India about personal data.`);
  }
  return { removed };
}

export const orderView = (o) => ({
  id: o.id, ref: o.ref_no, source: o.source, authority: o.authority, orderRef: o.order_ref, orderDate: o.order_date, kind: o.kind,
  receivedAt: o.received_at, dueAt: o.due_at, contentUrls: (o.content_urls || '').split('\n').filter(Boolean), targetUsername: o.target_username,
  summary: o.summary, verified: !!o.verified, status: o.status, actionNote: o.action_note, removedCount: o.removed_count,
  doneAt: o.done_at, doneBy: o.done_by, createdBy: o.created_by, createdAt: o.created_at,
});

export async function addOrder(d, req) {
  const hours = ORDER_HOURS[d.kind];
  const received = d.receivedAt ? new Date(d.receivedAt) : new Date();
  const o = await one(`INSERT INTO legal_orders (source, authority, order_ref, order_date, kind, received_at, due_at, content_urls, target_username, summary, verified, created_by)
    OUTPUT INSERTED.* VALUES ($1,$2,$3,$4,$5,$6, DATEADD(HOUR, ${hours}, $6), $7,$8,$9,$10,$11)`,
  [d.source, d.authority, d.orderRef || null, d.orderDate || null, d.kind, received, (d.contentUrls || []).join('\n') || null, d.targetUsername || null, d.summary, d.verified ? 1 : 0, req?.cu?.name || null]);
  await audit(req, 'legal_order_received', { actorId: null, detail: `L${o.ref_no} ${d.kind} from ${d.authority}` });
  mail(GRIEVANCE_EMAIL, `Legal order L${o.ref_no} (${d.kind.replace('_', ' ')}): act by ${ist(o.due_at)}`, `From: ${d.authority} (${d.source})\nTheir ref: ${d.orderRef || '-'}\n\n${d.summary}\n\nHandle it in the console: Legal › Orders.`);
  return o;
}

export async function actOnOrder(o, { action, note }, req) {
  let removed = 0;
  if (action === 'remove') {
    for (const url of (o.content_urls || '').split('\n').filter(Boolean)) removed += await removeLinked(url, 'legal').catch(() => 0);
  }
  const status = action === 'reject' ? 'rejected' : action === 'remove' || action === 'done' ? 'done' : o.status;
  await query(`UPDATE legal_orders SET status=$2, action_note=COALESCE($3, action_note), removed_count=removed_count+$4, done_at=SYSDATETIMEOFFSET(), done_by=$5 WHERE id=$1`,
    [o.id, status, note || null, removed, req?.cu?.name || null]);
  await audit(req, 'legal_order_' + action, { actorId: null, detail: `L${o.ref_no} by ${req?.cu?.name || 'team'}: ${removed} removed. ${note || ''}`.slice(0, 900) });
  return { removed, status };
}

/** Hourly: reminders for complaints and orders that are close to their deadline. */
export async function remindLegalDeadlines() {
  try {
    const g = await many(`SELECT * FROM grievances WHERE status IN (N'open', N'in_progress') AND reminded_at IS NULL AND due_at < DATEADD(DAY, 2, SYSDATETIMEOFFSET())`);
    for (const x of g) {
      await query('UPDATE grievances SET reminded_at=SYSDATETIMEOFFSET() WHERE id=$1', [x.id]);
      mail(GRIEVANCE_EMAIL, `Reminder: complaint #${x.ticket_no} is due ${ist(x.due_at)}`, `${x.name}: ${CATEGORIES[x.category]}\n\nConsole: Legal › Complaints.`);
    }
    const o = await many(`SELECT * FROM legal_orders WHERE status=N'open' AND reminded_at IS NULL AND due_at < DATEADD(HOUR, 2, SYSDATETIMEOFFSET())`);
    for (const x of o) {
      await query('UPDATE legal_orders SET reminded_at=SYSDATETIMEOFFSET() WHERE id=$1', [x.id]);
      mail(GRIEVANCE_EMAIL, `URGENT: legal order L${x.ref_no} is due ${ist(x.due_at)}`, `${x.authority}: ${x.summary}\n\nConsole: Legal › Orders.`);
    }
    return g.length + o.length;
  } catch { return 0; }
}

/** Counts for the console header. */
export async function legalSummary() {
  return one(`SELECT
    (SELECT COUNT(*) FROM grievances WHERE status IN (N'open', N'in_progress')) AS open_complaints,
    (SELECT COUNT(*) FROM grievances WHERE status IN (N'open', N'in_progress') AND due_at < SYSDATETIMEOFFSET()) AS late_complaints,
    (SELECT COUNT(*) FROM grievances WHERE urgent = 1 AND status IN (N'open', N'in_progress')) AS urgent_complaints,
    (SELECT COUNT(*) FROM legal_orders WHERE status = N'open') AS open_orders,
    (SELECT COUNT(*) FROM legal_orders WHERE status = N'open' AND due_at < SYSDATETIMEOFFSET()) AS late_orders,
    (SELECT COUNT(*) FROM banned_identities WHERE kind = N'ban' AND lifted_at IS NULL AND expires_at > SYSDATETIMEOFFSET()) AS active_bans`);
}
