// Soulink's public business page (/about): what Soulink is, what costs money and how much, upcoming Soul Events,
// the company's contact details and the policies. Open without signing in, for visitors, payment partners
// (Razorpay's website check) and app-store reviewers. Plain server-rendered HTML: no app, no login, no tracking.
import { many } from '../db.js';
import { SPREAD_PLANS } from '../services/spread.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const KIND = { pub: 'Pub night', run: 'Run', sport: 'Tournament', music: 'Music', social: 'Social', workshop: 'Workshop' };
const when = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export async function aboutPage(req, res) {
  let events = [];
  try {
    events = await many(`SELECT TOP 12 title, kind, tagline, venue, city, starts_at, price FROM soul_events
      WHERE status = N'published' AND starts_at > SYSDATETIMEOFFSET() ORDER BY starts_at`);
  } catch { /* database waking up: the page still shows everything else */ }
  const spread = SPREAD_PLANS.map((p) => `${p.days} day${p.days > 1 ? 's' : ''} ${rs(p.priceInr)}`).join(' · ');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soulink · by QM46 Solutions Private Limited</title>
<meta name="description" content="Soulink is a social app to make friends and real connections, matched by how you think (Soul DNA). Soul Events, Premium and more. By QM46 Solutions Private Limited, Hyderabad.">
<style>
:root{--void:#08070d;--card:#15131f;--line:#2a2740;--text:#e9e7f2;--muted:#8b88a0;--soul:#7c5cfc;--aura:#b08fff;--spark:#ff6b9d;--mint:#42e8c0;--gold:#f5c842}
*{box-sizing:border-box}body{margin:0;background:var(--void);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6}
.w{width:min(980px,92vw);margin:0 auto}header{padding:56px 0 28px;text-align:center}
.logo{font-weight:800;font-size:clamp(44px,9vw,72px);letter-spacing:-2px;background:linear-gradient(120deg,#fff,var(--aura),var(--spark));-webkit-background-clip:text;background-clip:text;color:transparent;margin:0}
.tag{color:var(--muted);font-size:18px;max-width:620px;margin:10px auto 22px}
.btn{display:inline-block;margin:6px;padding:13px 24px;border-radius:999px;font-weight:700;text-decoration:none;color:#fff;background:linear-gradient(120deg,var(--soul),var(--spark))}
.btn.o{background:none;border:1px solid var(--line)}
h2{font-size:26px;margin:44px 0 14px}.k{font:12px ui-monospace,monospace;letter-spacing:2px;color:var(--aura)}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.c{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}.c h3{margin:0 0 6px;font-size:17px}.c p{margin:0;color:var(--muted);font-size:14.5px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}
td,th{padding:13px 16px;border-bottom:1px solid var(--line);text-align:left;font-size:14.5px;vertical-align:top}th{color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
.p{white-space:nowrap;font-weight:700;color:var(--gold)}.m{color:var(--muted)}
footer{margin:56px 0 40px;padding-top:24px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}footer a{color:var(--aura)}
</style></head><body><div class="w">
<header><p class="logo">Soulink</p><p class="tag">A social app to make friends and real connections in India. People are matched by how they think and react (their Soul DNA), not by followers or swiping.</p>
<a class="btn" href="/">Open Soulink</a><a class="btn o" href="https://play.google.com/store/apps/details?id=app.soulink.mobile">Get it on Google Play</a></header>

<div class="k">WHAT YOU CAN DO</div>
<div class="g">
<div class="c"><h3>Soul DNA matching</h3><p>Short games show how you think, act and react. Soulink suggests people you'll get along with, with a match score.</p></div>
<div class="c"><h3>Connect and chat</h3><p>Send a Connect request with your intent. Chat opens only when both agree. Posts, Moments and Sparks (short videos).</p></div>
<div class="c"><h3>Soul Events</h3><p>Real-life events we organise in Hyderabad: pub nights, runs and tournaments, with a QR ticket for entry.</p></div>
<div class="c"><h3>Safe by design</h3><p>Every account is face-verified at sign-up, private by default, 18+ only, with reporting and a Grievance Officer.</p></div>
</div>

<h2>Prices</h2>
<p class="m">Soulink is free to join and use. These extras are optional. All prices are in Indian rupees and include GST. Payments are processed securely by Razorpay; we never store card or bank details.</p>
<table>
<tr><th>Product</th><th>What you get</th><th>Price</th></tr>
<tr><td>Soul Events ticket</td><td>Entry to one event for one person (QR ticket, ID checked at the gate). Each event shows its own price before you pay.</td><td class="p">${events.length ? `From ${rs(Math.min(...events.map((e) => Number(e.price))))} per event` : 'Shown on each event'}</td></tr>
<tr><td>One-time message</td><td>Send one message to someone you are not connected with; it lands in their Requests.</td><td class="p">₹500 per message</td></tr>
<tr><td>Spread around</td><td>Promote your post or Spark to more people in your city.</td><td class="p">${esc(spread)}</td></tr>
<tr><td>Premium</td><td>Your full Soul DNA report, why you matched with someone, and editing your Soul DNA.</td><td class="p">Price shown in the app before you buy</td></tr>
</table>

<h2>Upcoming Soul Events</h2>
${events.length ? `<table><tr><th>Event</th><th>When (IST)</th><th>Where</th><th>Ticket</th></tr>
${events.map((e) => `<tr><td><b>${esc(e.title)}</b><div class="m">${esc(KIND[e.kind] || 'Event')}${e.tagline ? ` · ${esc(e.tagline)}` : ''}</div></td><td>${esc(when(e.starts_at))}</td><td>${esc(e.venue)}, ${esc(e.city)}</td><td class="p">${Number(e.price) ? rs(e.price) : 'Free'}</td></tr>`).join('')}</table>`
    : '<div class="c"><p>New events are announced in the app. Register and pay in the Soulink app; your QR ticket is sent straight away.</p></div>'}
<p class="m">How it works: choose an event in the app, register with your name, phone, address and a government ID, pay online, and show your QR ticket at the gate. Refunds: full refund if you cancel at least 48 hours before the event; full refund if we cancel.</p>

<h2>Contact us</h2>
<div class="g">
<div class="c"><h3>QM46 Solutions Private Limited</h3><p>Flat No. 501, Plot No. 31 &amp; 48, Sri Venkateshwara Nilyam, L B Nagar, Hyderabad 500074, Telangana, India</p></div>
<div class="c"><h3>Email and phone</h3><p><a style="color:var(--aura)" href="mailto:quantum46solutions@gmail.com">quantum46solutions@gmail.com</a><br>+91 81438 88593<br>Mon–Sat, 10 am – 7 pm IST</p></div>
<div class="c"><h3>Complaints</h3><p>Our Grievance Officer answers within 24 hours and resolves within 7 days. <a style="color:var(--aura)" href="/legal/grievance">Grievance Officer</a></p></div>
</div>

<footer><a href="/legal/terms">Terms of Use</a> · <a href="/legal/privacy">Privacy Policy</a> · <a href="/legal/refunds">Refund &amp; Cancellation Policy</a> · <a href="/legal/guidelines">Community Guidelines</a> · <a href="/legal/grievance">Grievance Officer</a>
<p>© ${new Date().getFullYear()} QM46 Solutions Private Limited. Soulink is a product of QM46 Solutions Private Limited, Hyderabad, India.</p></footer>
</div></body></html>`);
}
