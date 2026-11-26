// Soul Events in the app.
//  GET  /events                          published events (upcoming first) + my registrations + how payment works now
//  GET  /events/tickets                  my paid tickets (with QR)
//  GET  /events/:id                      one event, my registration, and what to pre-fill (name, phone, last address)
//  POST /events/:id/register             multipart: fullName, address, idType, idProof (photo or PDF)
//  POST /events/registrations/:id/pay    starts payment: Razorpay link, or test mode
//  POST /events/registrations/:id/test-pay   test mode only: marks it paid
//  POST /events/registrations/:id/refresh    after the payment page: did it go through?
//  GET  /events/registrations/:id        one registration (ticket QR once paid)
//  Staff (Soulink team): POST /events/check-in { code, eventId? } · GET /events/:id/attendees
//  Public (opened in the browser): GET /events/pay/:id?k=&r=  ·  POST /events/pay/:id/verify
import express, { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, HttpError, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile, removeFile } from '../providers/storage.js';
import { isAdmin } from '../lib/payments.js';
import { createOrder, paidPaymentOf, razorpayKeyId, razorpayOn, signatureOk } from '../lib/razorpay.js';
import { attendees, checkIn, EVENT_COLS, eventView, ID_TYPES, markPaid, maskPhone, payModeFor, payToken, payTokenOk, regView } from '../services/events.js';

const r = Router();
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const staffOnly = (req, res, next) => (isAdmin(req.user) ? next() : next(forbidden('Only Soulink event staff can do this', 'not_staff')));
const ageOf = (d) => { if (!d) return null; const b = new Date(d); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

async function eventById(id, { publishedOnly = true } = {}) {
  const e = await one(`SELECT ${EVENT_COLS} FROM soul_events e WHERE e.id = $1`, [uuid.parse(id)]);
  if (!e || (publishedOnly && !['published', 'closed', 'cancelled'].includes(e.status))) throw notFound('Event not found');
  return e;
}
async function myReg(req, id) {
  const x = await one('SELECT * FROM event_registrations WHERE id = $1', [uuid.parse(id)]);
  if (!x || x.user_id.toLowerCase() !== req.user.id.toLowerCase()) throw notFound('Registration not found');
  return x;
}

// ---------- public: the payment page (Razorpay Checkout in the phone's browser) ----------
// The app can't take card/UPI payments itself without a new store build, so it opens this page; when it's done the
// page sends the person back to the app (soulink://events) where the ticket appears.
const okReturn = (u, req) => {
  const s = String(u || '');
  if (/^(soulink|exp|exps):\/\//i.test(s)) return s;
  try { const x = new URL(s); if (x.protocol === 'https:' && x.host === req.get('host')) return s; } catch { /* not a URL */ }
  return 'soulink://events';
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08070d;color:#e9e7f2;font-family:Inter,system-ui,-apple-system,sans-serif}
.c{width:min(420px,92vw);padding:28px 22px;border-radius:22px;background:#15131f;border:1px solid #2a2740;text-align:center}
h1{font-size:22px;margin:6px 0 4px}p{color:#8b88a0;font-size:14px;line-height:1.5;margin:6px 0}.w{font-weight:800;font-size:28px;background:linear-gradient(120deg,#fff,#b08fff,#ff6b9d);-webkit-background-clip:text;color:transparent}
.b{display:block;margin-top:18px;padding:14px;border-radius:999px;border:0;font-size:16px;font-weight:700;color:#fff;background:linear-gradient(120deg,#7c5cfc,#ff6b9d);text-decoration:none;cursor:pointer;width:100%}
.t{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;border:1px solid #f5c842;color:#f5c842;font:11px monospace;letter-spacing:1px}.e{color:#ff5c7a}</style></head>
<body><div class="c"><div class="w">Soulink</div>${body}</div></body></html>`;

r.get('/pay/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const back = okReturn(req.query.r, req);
  res.set('Cache-Control', 'no-store');
  // Razorpay's card / net-banking step opens the bank page in a pop-up that inherits this page's security headers:
  // a strict content policy left it blank, and the default opener policy cut the pop-up off from the checkout.
  res.removeHeader('Content-Security-Policy');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!payTokenOk(id, req.query.k)) return res.status(403).send(page('Link expired', `<h1>This payment link has expired</h1><p>Go back to Soulink and tap Pay again.</p><a class="b" href="${esc(back)}">Back to Soulink</a>`));
  const x = await one(`SELECT r.*, e.title, e.starts_at FROM event_registrations r JOIN soul_events e ON e.id = r.event_id WHERE r.id = $1`, [id]);
  if (!x) return res.status(404).send(page('Not found', '<h1>Registration not found</h1>'));
  const ret = `${back}${back.includes('?') ? '&' : '?'}reg=${x.id}`;
  if (x.status === 'paid') return res.send(page('Paid', `<h1>You're in!</h1><p>Your ticket for ${esc(x.title)} is in the Soulink app.</p><a class="b" href="${esc(ret)}">Open my ticket</a>`));
  if (!razorpayOn() || !x.rzp_order_id) return res.status(409).send(page('Payment', `<h1>Payment isn't ready</h1><p>Go back to Soulink and tap Pay again.</p><a class="b" href="${esc(back)}">Back to Soulink</a>`));
  // redirect mode: the whole page goes to the bank and comes back to /callback (no pop-ups, which phones often block)
  const api = req.originalUrl.startsWith('/api/') ? '/api' : '';
  const callback = `${req.protocol}://${req.get('host')}${api}${req.baseUrl}/pay/${x.id}/callback?k=${encodeURIComponent(String(req.query.k))}&r=${encodeURIComponent(back)}`;
  const opts = { key: razorpayKeyId(), order_id: x.rzp_order_id, callback_url: callback, redirect: true, amount: x.amount * 100, currency: 'INR', name: 'Soulink Events', description: x.title.slice(0, 250),
    prefill: { name: x.full_name, contact: x.phone }, notes: { registration: x.id }, theme: { color: '#7c5cfc' } };
  res.send(page('Pay for ' + x.title, `<h1>${esc(x.title)}</h1><p>₹${Number(x.amount).toLocaleString('en-IN')} · ${esc(x.full_name)}</p>
${razorpayKeyId().startsWith('rzp_test_') ? '<span class="t">TEST MODE · NO REAL MONEY</span>' : ''}
<p id="m" ></p><button class="b" id="go">Pay ₹${Number(x.amount).toLocaleString('en-IN')}</button><a class="b" style="background:#2a2740" href="${esc(back)}">Cancel</a>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var o=${JSON.stringify(opts).replace(/</g, '\\u003c')},k=${JSON.stringify(String(req.query.k))},ret=${JSON.stringify(ret)},m=document.getElementById('m');
o.handler=function(p){m.textContent='Confirming your payment…';m.className='';
 fetch(location.pathname+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:k,paymentId:p.razorpay_payment_id,orderId:p.razorpay_order_id,signature:p.razorpay_signature})})
 .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d&&d.error&&d.error.message||'');return d;});})
 .then(function(){document.querySelector('.c').innerHTML='<div class="w">Soulink</div><h1>You\\'re in! 🎉</h1><p>Your QR ticket is ready in the app.</p><a class="b" href="'+ret+'">Open my ticket</a>';location.href=ret;})
 .catch(function(e){m.className='e';m.textContent=(e.message||'We could not confirm it yet.')+' If money was taken, open Soulink: your ticket will appear.';});};
o.modal={ondismiss:function(){m.className='';m.textContent='Payment not finished. Tap Pay to try again.';}};
var rz=new Razorpay(o);rz.on('payment.failed',function(r){m.className='e';m.textContent=(r.error&&r.error.description)||'The payment failed. Try again.';});
document.getElementById('go').onclick=function(){rz.open();};rz.open();
</script>`));
}));

// Razorpay sends the person back here (form POST) after the bank page: check the signature, issue the ticket, return to the app.
r.post('/pay/:id/callback', express.urlencoded({ extended: true, limit: '20kb' }), ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const back = okReturn(req.query.r, req);
  const ret = `${back}${back.includes('?') ? '&' : '?'}reg=${id}`;
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  const b = req.body || {};
  const x = await one('SELECT * FROM event_registrations WHERE id = $1', [id]);
  if (!x) return res.status(404).send(page('Not found', '<h1>Registration not found</h1>'));
  const retry = `${req.baseUrl}/pay/${id}?k=${encodeURIComponent(String(req.query.k || ''))}&r=${encodeURIComponent(back)}`;
  if (x.status !== 'paid') {
    const ok = b.razorpay_payment_id && b.razorpay_order_id === x.rzp_order_id && signatureOk(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature);
    if (!ok) {
      const why = b['error[description]'] || b.error?.description || 'The payment did not go through.';
      return res.send(page('Payment failed', `<h1>Payment not completed</h1><p class="e">${esc(String(why).slice(0, 200))}</p><p>No money was taken. If it was, your ticket will appear in Soulink shortly.</p>
<a class="b" href="${esc(payTokenOk(id, req.query.k) ? (req.originalUrl.startsWith('/api/') ? '/api' : '') + retry : back)}">Try again</a><a class="b" style="background:#2a2740" href="${esc(back)}">Back to Soulink</a>`));
    }
    await markPaid(id, { mode: 'live', paymentId: b.razorpay_payment_id });
  }
  res.send(page('Paid', `<h1>You're in! 🎉</h1><p>Your QR ticket is ready in the Soulink app.</p><a class="b" href="${esc(ret)}">Open my ticket</a>
<script>setTimeout(function(){location.href=${JSON.stringify(ret).replace(/</g, '\\u003c')};},600);</script>`));
}));

r.post('/pay/:id/verify', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const d = z.object({ k: z.string(), paymentId: z.string().max(60), orderId: z.string().max(60), signature: z.string().max(200) }).parse(req.body || {});
  if (!payTokenOk(id, d.k)) throw forbidden('This payment link has expired. Open Soulink: if you paid, your ticket will appear.', 'link_expired');
  const x = await one('SELECT * FROM event_registrations WHERE id = $1', [id]);
  if (!x) throw notFound('Registration not found');
  if (x.status === 'paid') return res.json({ ok: true, ticketCode: x.ticket_code });
  if (x.rzp_order_id !== d.orderId || !signatureOk(d.orderId, d.paymentId, d.signature)) throw badRequest("We couldn't confirm this payment", 'bad_signature');
  const paid = await markPaid(id, { mode: 'live', paymentId: d.paymentId });
  res.json({ ok: true, ticketCode: paid?.ticket_code || null });
}));

// ---------- signed-in ----------
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const rows = await many(`SELECT ${EVENT_COLS} FROM soul_events e WHERE e.status IN (N'published', N'closed', N'cancelled')
    AND COALESCE(e.ends_at, e.starts_at) > DATEADD(DAY, -2, SYSDATETIMEOFFSET()) ORDER BY e.starts_at`);
  const regs = await many(`SELECT id, event_id, status, ticket_code, checked_in_at FROM event_registrations WHERE user_id = $1 AND status <> N'cancelled'`, [req.user.id]);
  const mine = {}; regs.forEach((x) => { mine[x.event_id.toLowerCase()] = { id: x.id, status: x.status, checkedIn: !!x.checked_in_at }; });
  res.json({ events: rows.map(eventView).map((e) => ({ ...e, mine: mine[e.id.toLowerCase()] || null })), payMode: payModeFor(req.user), staff: isAdmin(req.user) });
}));

r.get('/tickets', ah(async (req, res) => {
  const rows = await many(`SELECT r.*, e.title, e.venue, e.city, e.starts_at, e.kind FROM event_registrations r JOIN soul_events e ON e.id = r.event_id
    WHERE r.user_id = $1 AND r.status = N'paid' ORDER BY e.starts_at DESC`, [req.user.id]);
  res.json({ tickets: rows.map((x) => ({ ...regView(x, { withQr: true }), event: { title: x.title, venue: x.venue, city: x.city, startsAt: x.starts_at, kind: x.kind } })) });
}));

r.get('/registrations/:id', ah(async (req, res) => {
  const x = await myReg(req, req.params.id);
  res.json({ registration: regView(x, { withQr: true }), event: eventView(await eventById(x.event_id, { publishedOnly: false })) });
}));

// staff: scan a ticket at the gate (each ticket works once)
r.post('/check-in', staffOnly, ah(async (req, res) => {
  const d = z.object({ code: z.string().min(1).max(200), eventId: uuid.optional() }).parse(req.body || {});
  res.json(await checkIn(d.code, { by: `@${req.user.username}`, eventId: d.eventId }));
}));

r.get('/:id', ah(async (req, res) => {
  const e = await eventById(req.params.id);
  const reg = await one(`SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2`, [e.id, req.user.id]);
  const last = reg || await one('SELECT TOP 1 full_name, address FROM event_registrations WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({
    event: eventView(e), registration: reg && reg.status !== 'cancelled' ? regView(reg, { withQr: true }) : null,
    prefill: { fullName: last?.full_name || req.user.display_name || '', phone: req.user.phone || '', address: last?.address || '' },
    idTypes: Object.entries(ID_TYPES).map(([id, label]) => ({ id, label })), payMode: payModeFor(req.user), staff: isAdmin(req.user),
  });
}));

r.get('/:id/attendees', staffOnly, ah(async (req, res) => {
  const e = await eventById(req.params.id, { publishedOnly: false });
  const list = await attendees(e.id);
  res.json({ event: eventView(e), attendees: list.map((a) => ({ id: a.id, name: a.full_name, phone: maskPhone(a.phone), username: a.username, status: a.status,
    code: a.ticket_code, checkedInAt: a.checked_in_at, checkedInBy: a.checked_in_by })) });
}));

r.post('/:id/register', uploadMemory('idproof', 8).single('idProof'), ah(async (req, res) => {
  const e = await eventById(req.params.id);
  const d = z.object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    address: z.string().trim().min(10, 'Enter your full address').max(400),
    idType: z.enum(Object.keys(ID_TYPES), { error: 'Choose your ID type' }),
  }).parse(req.body || {});
  if (!req.user.phone) throw badRequest('Add your phone number in Settings › Account first', 'phone_needed');
  const existing = await one('SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2', [e.id, req.user.id]);
  if (existing?.status === 'paid') throw badRequest("You're already registered for this event", 'already_registered');
  const v = eventView(e);
  if (e.status !== 'published' || v.ended) throw badRequest('Registrations for this event are closed', 'closed');
  const holding = existing?.status === 'pending' && existing.rzp_order_id && Date.now() - new Date(existing.updated_at).getTime() < 20 * 60_000;
  if (v.soldOut && !holding) throw badRequest('Sorry, this event is sold out', 'sold_out');
  if (e.min_age) { const a = ageOf(req.user.birth_date); if (a !== null && a < e.min_age) throw badRequest(`This event is for ${e.min_age}+ only`, 'too_young'); }
  if (!req.file && !existing?.id_proof_url) throw badRequest('Upload a photo or PDF of your government ID', 'id_needed');

  const proof = req.file ? await saveFile(req.file, 'event-ids', 'idproof') : existing.id_proof_url;
  if (req.file && existing?.id_proof_url) removeFile(existing.id_proof_url).catch(() => {});
  let x;
  if (existing) {
    x = await one(`UPDATE event_registrations SET full_name=$2, phone=$3, address=$4, id_type=$5, id_proof_url=$6, amount=$7, status=N'pending',
      updated_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1`, [existing.id, d.fullName, req.user.phone, d.address, d.idType, proof, e.price]);
  } else {
    x = await one(`INSERT INTO event_registrations (event_id, user_id, full_name, phone, address, id_type, id_proof_url, amount)
      OUTPUT INSERTED.* VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [e.id, req.user.id, d.fullName, req.user.phone, d.address, d.idType, proof, e.price]);
  }
  if (Number(e.price) === 0) x = await markPaid(x.id, { mode: 'free' }); // free events: the ticket comes straight away
  res.json({ registration: regView(x, { withQr: true }), payMode: payModeFor(req.user) });
}));

r.post('/registrations/:id/pay', ah(async (req, res) => {
  const x = await myReg(req, req.params.id);
  if (x.status === 'paid') return res.json({ mode: 'paid', registration: regView(x, { withQr: true }) });
  if (x.status !== 'pending') throw badRequest('This registration was cancelled', 'cancelled');
  const e = await eventById(x.event_id);
  const v = eventView(e);
  if (e.status !== 'published' || v.ended) throw badRequest('Registrations for this event are closed', 'closed');
  const mode = payModeFor(req.user);
  if (mode === 'off') throw new HttpError(503, 'Payments open very soon. Your registration is saved: come back to pay.', 'payments_off');
  if (mode === 'test') return res.json({ mode: 'test', amount: x.amount });
  const fresh = x.rzp_order_id && Date.now() - new Date(x.updated_at).getTime() < 20 * 60_000 && Number(x.amount) === Number(e.price);
  if (!fresh && v.soldOut) throw badRequest('Sorry, this event is sold out', 'sold_out');
  if (!fresh) {
    const o = await createOrder(e.price, `ev-${String(x.id).slice(0, 8)}-${Date.now().toString(36)}`, { registration: x.id, event: e.title.slice(0, 200) });
    await query('UPDATE event_registrations SET rzp_order_id=$2, amount=$3, updated_at=SYSDATETIMEOFFSET() WHERE id=$1', [x.id, o.id, e.price]);
  }
  const ret = String(req.body?.returnUrl || '').slice(0, 300);
  const api = req.originalUrl.startsWith('/api/') ? '/api' : ''; // the cloud serves the API under /api
  const url = `${req.protocol}://${req.get('host')}${api}${req.baseUrl}/pay/${x.id}?k=${encodeURIComponent(payToken(x.id))}&r=${encodeURIComponent(ret)}`;
  res.json({ mode, url, amount: e.price });
}));

r.post('/registrations/:id/test-pay', ah(async (req, res) => {
  const x = await myReg(req, req.params.id);
  if (payModeFor(req.user) !== 'test') throw forbidden('Test payments are off', 'not_test');
  const paid = x.status === 'paid' ? x : await markPaid(x.id, { mode: 'test' });
  res.json({ registration: regView(paid, { withQr: true }) });
}));

// back from the payment page: Razorpay is asked whether the order was paid (covers a closed page or a lost signal)
r.post('/registrations/:id/refresh', ah(async (req, res) => {
  let x = await myReg(req, req.params.id);
  if (x.status === 'pending' && x.rzp_order_id && razorpayOn()) {
    const p = await paidPaymentOf(x.rzp_order_id).catch(() => null);
    if (p && p.order_id === x.rzp_order_id && Number(p.amount) === Number(x.amount) * 100) x = await markPaid(x.id, { mode: 'live', paymentId: p.id });
  }
  res.json({ registration: regView(x, { withQr: true }) });
}));

export default r;
