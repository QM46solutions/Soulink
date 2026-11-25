// Soul Events: shared logic for the app (routes/events.js) and the team console (routes/consoleEvents.js).
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { many, one, query } from '../db.js';
import { config } from '../config.js';
import { isAdmin, testPaymentsAllowed } from '../lib/payments.js';
import { razorpayOn, razorpaySandbox } from '../lib/razorpay.js';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

export const KINDS = ['pub', 'run', 'sport', 'music', 'social', 'workshop'];
export const ID_TYPES = { aadhaar: 'Aadhaar', pan: 'PAN card', dl: 'Driving licence', passport: 'Passport' };
export const HOLD_MINUTES = 20; // a seat is held this long while someone is paying

/** How tickets are paid right now, for this person:
 *  razorpay — real checkout (with rzp_test_ keys it is Razorpay's sandbox: no real money)
 *  test     — no gateway yet: a "Pay (test)" button marks it paid (laptop, PAYMENTS_TEST=1, or the Soulink team)
 *  off      — payments not switched on: registrations wait */
export function payModeFor(user) {
  if (razorpayOn()) return razorpaySandbox() ? 'razorpay-test' : 'razorpay';
  if (testPaymentsAllowed() || isAdmin(user)) return 'test';
  return 'off';
}

const SEATS_SQL = `(SELECT COUNT(*) FROM event_registrations x WHERE x.event_id = e.id AND (x.status = N'paid'
  OR (x.status = N'pending' AND x.rzp_order_id IS NOT NULL AND x.updated_at > DATEADD(MINUTE, -${HOLD_MINUTES}, SYSDATETIMEOFFSET()))))`;
export const EVENT_COLS = `e.*, ${SEATS_SQL} AS taken,
  (SELECT COUNT(*) FROM event_registrations x WHERE x.event_id = e.id AND x.status = N'paid') AS sold,
  (SELECT COUNT(*) FROM event_registrations x WHERE x.event_id = e.id AND x.checked_in_at IS NOT NULL) AS checked_in`;

export const eventView = (e) => {
  const left = Math.max(0, Number(e.capacity) - Number(e.taken || 0));
  const now = Date.now();
  const ended = new Date(e.ends_at || e.starts_at).getTime() + (e.ends_at ? 0 : 6 * 3600_000) < now;
  return {
    id: e.id, title: e.title, kind: e.kind, tagline: e.tagline || null, description: e.description || null,
    venue: e.venue, city: e.city, mapUrl: e.map_url || null, startsAt: e.starts_at, endsAt: e.ends_at || null,
    price: Number(e.price), capacity: Number(e.capacity), seatsLeft: left, minAge: e.min_age ?? null, coverUrl: e.cover_url || null,
    status: e.status, soldOut: left <= 0, ended, open: e.status === 'published' && !ended && left > 0,
  };
};

/** Each ticket's code: SL + 10 letters/digits that can't be misread (no 0/O, 1/I). */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newTicketCode = () => 'SL' + [...crypto.randomBytes(10)].map((b) => ALPHA[b % ALPHA.length]).join('');
export const QR_PREFIX = 'SOULINK-TICKET:';
/** The QR as rows of 0/1 (the app draws it; no image to download). */
export function qrRows(code) {
  const q = new QRCode(-1, QRLevel.M);
  q.addData(QR_PREFIX + code); q.make();
  const n = q.getModuleCount(); const rows = [];
  for (let r = 0; r < n; r++) { let s = ''; for (let c = 0; c < n; c++) s += q.isDark(r, c) ? '1' : '0'; rows.push(s); }
  return rows;
}
/** Accepts what a scanner read ("SOULINK-TICKET:SL…") or a code typed by hand. */
export const codeFrom = (text) => String(text || '').trim().toUpperCase().replace(/^SOULINK-TICKET:/, '').replace(/[^A-Z0-9]/g, '').slice(0, 24);

export const regView = (x, { withQr = false } = {}) => ({
  id: x.id, eventId: x.event_id, fullName: x.full_name, phone: x.phone, address: x.address, idType: x.id_type,
  idTypeLabel: ID_TYPES[x.id_type] || x.id_type, hasIdProof: !!x.id_proof_url, amount: Number(x.amount), status: x.status,
  payMode: x.pay_mode || null, ticketCode: x.status === 'paid' ? x.ticket_code : null, paidAt: x.paid_at || null,
  checkedInAt: x.checked_in_at || null, createdAt: x.created_at,
  ...(withQr && x.status === 'paid' && x.ticket_code ? { qr: qrRows(x.ticket_code) } : {}),
});

/** Marks a registration paid (once) and gives it a ticket. Returns the updated row. */
export async function markPaid(regId, { mode, paymentId = null }) {
  for (let i = 0; i < 3; i++) {
    try {
      const x = await one(`UPDATE event_registrations SET status = N'paid', pay_mode = $2, rzp_payment_id = COALESCE($3, rzp_payment_id),
          ticket_code = COALESCE(ticket_code, $4), paid_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET()
        OUTPUT INSERTED.* WHERE id = $1 AND status = N'pending'`, [regId, mode, paymentId, newTicketCode()]);
      return x || one('SELECT * FROM event_registrations WHERE id = $1', [regId]);
    } catch (e) { if (!/duplicate|unique/i.test(e.message) || i === 2) throw e; } // a ticket code clash: try another
  }
  return null;
}

/** Staff check-in: lets a ticket in once. result: ok | already | unpaid | wrong_event | invalid */
export async function checkIn(text, { by, eventId } = {}) {
  const code = codeFrom(text);
  if (code.length < 6) return { result: 'invalid' };
  const x = await one(`SELECT r.*, e.title AS event_title, e.starts_at FROM event_registrations r JOIN soul_events e ON e.id = r.event_id WHERE r.ticket_code = $1`, [code]);
  if (!x) return { result: 'invalid', code };
  const who = { name: x.full_name, phone: maskPhone(x.phone), event: x.event_title, eventId: x.event_id, code, idType: ID_TYPES[x.id_type] };
  if (eventId && x.event_id.toLowerCase() !== String(eventId).toLowerCase()) return { result: 'wrong_event', ...who };
  if (x.status !== 'paid') return { result: 'unpaid', ...who };
  const done = await one(`UPDATE event_registrations SET checked_in_at = SYSDATETIMEOFFSET(), checked_in_by = $2, updated_at = SYSDATETIMEOFFSET()
    OUTPUT INSERTED.checked_in_at WHERE id = $1 AND checked_in_at IS NULL`, [x.id, String(by || '').slice(0, 80) || null]);
  if (!done) return { result: 'already', ...who, checkedInAt: x.checked_in_at, checkedInBy: x.checked_in_by };
  return { result: 'ok', ...who, checkedInAt: done.checked_in_at };
}
export const maskPhone = (p) => (p ? String(p).replace(/^(\+?\d{2,3})\d+(\d{3})$/, '$1•••••$2') : '');

/** Attendees of one event (staff and console). */
export const attendees = (eventId) => many(`SELECT r.id, r.full_name, r.phone, r.status, r.ticket_code, r.amount, r.pay_mode, r.paid_at, r.checked_in_at, r.checked_in_by,
    r.id_type, r.created_at, CASE WHEN r.id_proof_url IS NULL THEN 0 ELSE 1 END AS has_id, u.username
  FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 AND r.status <> N'cancelled'
  ORDER BY CASE WHEN r.status = N'paid' THEN 0 ELSE 1 END, r.checked_in_at DESC, r.full_name`, [eventId]);

/** A short-lived signed link for the payment page (opened in the phone's browser, without the app's login). */
const paySig = (id, exp) => crypto.createHmac('sha256', `soulink-event-pay:${config.jwtSecret}`).update(`${id}|${exp}`).digest('base64url').slice(0, 32);
export function payToken(id) { const exp = Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60; return `${exp}.${paySig(id, exp)}`; }
export function payTokenOk(id, k) {
  const m = /^(\d{9,11})\.([A-Za-z0-9_-]{32})$/.exec(String(k || ''));
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const a = Buffer.from(paySig(id, Number(m[1]))); const b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Removes ID proofs 30 days after an event ends (we only need them for entry and safety). Runs daily. */
export async function purgeOldIdProofs(removeFile) {
  const rows = await many(`SELECT TOP 200 r.id, r.id_proof_url FROM event_registrations r JOIN soul_events e ON e.id = r.event_id
    WHERE r.id_proof_url IS NOT NULL AND COALESCE(e.ends_at, e.starts_at) < DATEADD(DAY, -30, SYSDATETIMEOFFSET())`);
  for (const x of rows) {
    await removeFile(x.id_proof_url).catch(() => {});
    await query('UPDATE event_registrations SET id_proof_url = NULL WHERE id = $1', [x.id]);
  }
  return rows.length;
}
