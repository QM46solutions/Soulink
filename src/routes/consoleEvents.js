// Team console: Soul Events (mounted at /console/events). Create and publish events, see who registered and paid,
// open an ID proof (streamed only to signed-in team members), and check people in at the gate.
import { Router } from 'express';
import { z } from 'zod';
import nodePath from 'node:path';
import { many, one, query } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireConsole } from '../lib/consoleAuth.js';
import { uploadMemory, saveFile, ensureLocal, removeFile } from '../providers/storage.js';
import { razorpayOn, razorpaySandbox } from '../lib/razorpay.js';
import { attendees, checkIn, EVENT_COLS, eventView, ID_TYPES, KINDS } from '../services/events.js';

const r = Router();
const VIEW = requireConsole('viewer', 'support', 'ads');
const EDIT = requireConsole('ads'); // owner + ads manager create events
const GATE = requireConsole('support', 'ads'); // check-in at the gate
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const log = (req, action) => query('INSERT INTO console_log (actor_id, actor_name, action) VALUES ($1, $2, $3)', [req.cu?.id || null, req.cu?.name || null, String(action).slice(0, 200)]).catch(() => {});

const eventBody = z.object({
  title: z.string().trim().min(3, 'Give the event a name').max(120),
  kind: z.enum(KINDS).default('social'),
  tagline: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
  venue: z.string().trim().min(3, 'Add the venue').max(200),
  city: z.string().trim().min(2, 'Add the city').max(60),
  mapUrl: z.string().trim().url('Use a full map link (https://…)').max(500).optional().or(z.literal('')),
  startsAt: z.string().min(10, 'Choose when it starts'),
  endsAt: z.string().optional().or(z.literal('')),
  price: z.coerce.number().int('Use whole rupees').min(0).max(100000),
  capacity: z.coerce.number().int().min(1, 'At least 1 seat').max(100000),
  minAge: z.coerce.number().int().min(0).max(99).optional().or(z.literal('')),
});
// "2026-12-06T19:00" from the form is Indian time
const istDate = (s) => { if (!s) return null; const v = /[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s.length === 16 ? s + ':00' : s}+05:30`; const d = new Date(v); if (Number.isNaN(d.getTime())) throw badRequest('Check the date and time'); return d; };

r.get('/', VIEW, ah(async (req, res) => {
  const rows = await many(`SELECT ${EVENT_COLS}, (SELECT ISNULL(SUM(x.amount), 0) FROM event_registrations x WHERE x.event_id = e.id AND x.status = N'paid' AND x.pay_mode = N'live') AS revenue
    FROM soul_events e ORDER BY CASE WHEN e.status IN (N'draft', N'published') THEN 0 ELSE 1 END, e.starts_at DESC`);
  res.json({ events: rows.map((e) => ({ ...eventView(e), sold: Number(e.sold), checkedIn: Number(e.checked_in), revenue: Number(e.revenue) })),
    payments: razorpayOn() ? (razorpaySandbox() ? 'razorpay-test' : 'razorpay') : 'not-set-up', kinds: KINDS });
}));

r.post('/', EDIT, uploadMemory('image', 8).single('cover'), ah(async (req, res) => {
  const d = eventBody.parse(req.body || {});
  const cover = req.file ? await saveFile(req.file, 'events', 'image') : null;
  const e = await one(`INSERT INTO soul_events (title, kind, tagline, description, venue, city, map_url, starts_at, ends_at, price, capacity, min_age, cover_url, created_by)
    OUTPUT INSERTED.id VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  [d.title, d.kind, d.tagline || null, d.description || null, d.venue, d.city, d.mapUrl || null, istDate(d.startsAt), istDate(d.endsAt), d.price, d.capacity, d.minAge === '' || d.minAge == null ? null : d.minAge, cover, req.cu.name]);
  log(req, `Created event "${d.title}" (draft)`); res.json({ id: e.id });
}));

r.patch('/:id', EDIT, uploadMemory('image', 8).single('cover'), ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const old = await one('SELECT * FROM soul_events WHERE id=$1', [id]);
  if (!old) throw notFound('Event not found');
  const d = eventBody.parse(req.body || {});
  const sold = await one(`SELECT COUNT(*) AS n FROM event_registrations WHERE event_id=$1 AND status=N'paid'`, [id]);
  if (Number(sold.n) > d.capacity) throw badRequest(`${sold.n} tickets are already sold: capacity can't go below that`);
  const cover = req.file ? await saveFile(req.file, 'events', 'image') : old.cover_url;
  if (req.file && old.cover_url) removeFile(old.cover_url).catch(() => {});
  await query(`UPDATE soul_events SET title=$2, kind=$3, tagline=$4, description=$5, venue=$6, city=$7, map_url=$8, starts_at=$9, ends_at=$10, price=$11,
    capacity=$12, min_age=$13, cover_url=$14, updated_at=SYSDATETIMEOFFSET() WHERE id=$1`,
  [id, d.title, d.kind, d.tagline || null, d.description || null, d.venue, d.city, d.mapUrl || null, istDate(d.startsAt), istDate(d.endsAt), d.price, d.capacity, d.minAge === '' || d.minAge == null ? null : d.minAge, cover]);
  log(req, `Edited event "${d.title}"`); res.json({ ok: true });
}));

// publish | close (stop registrations) | reopen | cancel
r.post('/:id/status', EDIT, ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['draft', 'published', 'closed', 'cancelled']) }).parse(req.body || {});
  const e = await one('UPDATE soul_events SET status=$2, updated_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.title WHERE id=$1', [id, status]);
  if (!e) throw notFound('Event not found');
  log(req, `${{ draft: 'Unpublished', published: 'Published', closed: 'Closed registrations for', cancelled: 'Cancelled' }[status]} event "${e.title}"`);
  res.json({ ok: true });
}));

r.get('/:id', VIEW, ah(async (req, res) => {
  const e = await one(`SELECT ${EVENT_COLS} FROM soul_events e WHERE e.id=$1`, [uuid.parse(req.params.id)]);
  if (!e) throw notFound('Event not found');
  const list = await attendees(e.id);
  res.json({ event: { ...eventView(e), sold: Number(e.sold), checkedIn: Number(e.checked_in), raw: { startsAt: e.starts_at, endsAt: e.ends_at } },
    attendees: list.map((a) => ({ id: a.id, name: a.full_name, phone: a.phone, username: a.username, status: a.status, code: a.ticket_code, amount: a.amount,
      payMode: a.pay_mode, paidAt: a.paid_at, checkedInAt: a.checked_in_at, checkedInBy: a.checked_in_by, idType: ID_TYPES[a.id_type], hasId: !!a.has_id, createdAt: a.created_at })) });
}));

// one person's address + ID proof (support / owner only: personal data)
r.get('/registrations/:rid', requireConsole('support'), ah(async (req, res) => {
  const x = await one('SELECT id, full_name, phone, address, id_type, id_proof_url FROM event_registrations WHERE id=$1', [uuid.parse(req.params.rid)]);
  if (!x) throw notFound('Registration not found');
  log(req, `Opened the registration details of ${x.full_name}`);
  res.json({ name: x.full_name, phone: x.phone, address: x.address, idType: ID_TYPES[x.id_type], hasId: !!x.id_proof_url });
}));
r.get('/registrations/:rid/id-proof', requireConsole('support'), ah(async (req, res) => {
  const x = await one('SELECT full_name, id_proof_url FROM event_registrations WHERE id=$1', [uuid.parse(req.params.rid)]);
  if (!x?.id_proof_url || !String(x.id_proof_url).startsWith('/uploads/event-ids/')) throw notFound('No ID proof (removed 30 days after the event)');
  log(req, `Viewed the ID proof of ${x.full_name}`);
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(nodePath.resolve(await ensureLocal(x.id_proof_url)));
}));

r.post('/check-in', GATE, ah(async (req, res) => {
  const d = z.object({ code: z.string().min(1).max(200), eventId: uuid.optional() }).parse(req.body || {});
  const out = await checkIn(d.code, { by: req.cu.name, eventId: d.eventId });
  if (out.result === 'ok') log(req, `Checked in ${out.name} (${out.event})`);
  res.json(out);
}));

export default r;
