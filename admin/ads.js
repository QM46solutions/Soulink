// Ads: customers, hourly bookings, payments, rate card, and customer reports as PDF and PowerPoint.
(function () {
  const { line, columns, bars, fmt, esc } = window.Charts;
  const C = window.__console; const { api, VIEWS, AFTER, st, kpi, rs, N, pct, dt, toast, render, canEdit, $ } = C;
  const PL = { feed: 'Between posts', sparks: 'Between Sparks' };
  const COLS = ['#7c4dff', '#e5487f', '#0ea5a4', '#d97706', '#2563eb', '#16a34a'];
  const colorOf = (s) => COLS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLS.length];
  const hrs = (list) => { const h = [...list].sort((a, b) => a - b); const out = []; let s = h[0]; let p = h[0];
    for (let i = 1; i <= h.length; i++) { if (h[i] !== p + 1) { out.push(s === p ? `${s}:00` : `${s}:00–${p + 1}:00`); s = h[i]; } p = h[i]; } return out.join(', '); };
  const bkStatus = (b) => { if (b.status === 'cancelled') return ['Cancelled', 'p-dim']; if (b.status === 'awaiting') return ['Awaiting payment', 'p-warn'];
    const now = Date.now(); if (b.ends_at && new Date(b.ends_at) < now) return ['Finished', 'p-dim']; if (!b.active) return ['Paused', 'p-warn'];
    if (b.starts_at && new Date(b.starts_at) > now) return ['Booked', 'p-acc']; return ['Running', 'p-good']; };

  // ---------- customers ----------
  VIEWS.ads = async () => {
    if (st.cust) return customerView();
    const d = await api('/ads/customers'); const cs = d.customers;
    const paid = cs.reduce((s, c) => s + N(c.paid), 0); const due = cs.reduce((s, c) => s + N(c.due), 0); const live = cs.reduce((s, c) => s + N(c.live), 0);
    const views = cs.reduce((s, c) => s + N(c.views), 0);
    return `<div class="grid k4">${kpi('Customers', fmt(cs.length), '')}${kpi('Ads live now', fmt(live), '', live ? 'up' : 'mu')}${kpi('Received, all time', rs(paid), 'incl. GST', 'up')}${kpi('To be paid', rs(due), due ? 'from bookings not fully paid' : 'nothing due', due ? 'wa' : 'up')}</div>
<div class="panel mt"><h3>Customers<span class="r">${canEdit('ads') ? '<a class="btn sm pri" href="#book">+ New booking</a><button class="btn sm" id="addCust">+ Add customer</button>' : ''}</span></h3>
${cs.length ? `<div class="tw"><table><tr><th>Customer</th><th class="n">Bookings</th><th class="n">Hours</th><th class="n">Booked</th><th class="n">Paid</th><th class="n">To pay</th><th class="n">Views</th><th class="n">Clicks</th><th>Status</th></tr>
${cs.map((c) => `<tr class="click" data-cust="${c.id}"><td><div class="cust"><span class="av" style="background:${colorOf(c.name)}">${esc(c.name[0])}</span><div><b>${esc(c.name)}</b><div class="small mu">${esc(c.kind || '')}</div></div></div></td>
 <td class="n">${c.bookings}</td><td class="n">${fmt(c.hours)}</td><td class="n">${rs(c.booked)}</td><td class="n">${rs(c.paid)}</td><td class="n ${N(c.due) ? 'wa' : ''}">${N(c.due) ? rs(c.due) : '—'}</td><td class="n">${fmt(c.views)}</td><td class="n">${fmt(c.clicks)}</td>
 <td>${N(c.live) ? '<span class="pill p-good">Ad running</span>' : N(c.due) ? '<span class="pill p-warn">Payment due</span>' : '<span class="pill p-dim">No live ads</span>'}</td></tr>`).join('')}</table></div>`
  : `<div class="empty">No customers yet. ${canEdit('ads') ? 'Add your first customer, then book their hours.' : ''}</div>`}
<p class="small mu">Click a customer to see every ad they booked, what they paid and how each ad performed.</p></div>`;
  };
  AFTER.ads = () => {
    document.querySelectorAll('[data-cust]').forEach((r) => { r.onclick = () => { st.cust = r.dataset.cust; st.ctab = 'ads'; render(); }; });
    const a = $('#addCust'); if (a) a.onclick = () => customerForm();
    wireCustomer();
  };
  function customerForm(c) {
    C.modal(c ? 'Edit customer' : 'Add a customer', `<div class="form"><label class="full">Business name<input id="c1" required maxlength="120" value="${esc(c?.name || '')}"></label><label>Type of business<input id="c2" maxlength="60" placeholder="Café, real estate, gym…" value="${esc(c?.kind || '')}"></label><label>Contact person<input id="c3" maxlength="80" value="${esc(c?.contact_name || '')}"></label>
      <label>Phone<input id="c4" maxlength="20" value="${esc(c?.phone || '')}"></label><label>Email<input id="c5" type="email" value="${esc(c?.email || '')}"></label><label>GST number<input id="c6" maxlength="20" value="${esc(c?.gst || '')}"></label><label class="full">Billing address<input id="c7" maxlength="300" value="${esc(c?.address || '')}"></label></div>`,
    async () => { const body = { name: $('#c1').value, kind: $('#c2').value, contactName: $('#c3').value, phone: $('#c4').value, email: $('#c5').value, gst: $('#c6').value, address: $('#c7').value };
      if (c) await api('/ads/customers/' + c.id, { method: 'PATCH', body }); else { const r = await api('/ads/customers', { method: 'POST', body }); st.cust = r.id; }
      toast(c ? 'Customer saved' : 'Customer added'); render(); });
  }

  let cur = null;
  async function customerView() {
    const d = await api('/ads/customers/' + st.cust); cur = d; const c = d.customer; const tab = st.ctab || 'ads';
    const live = d.bookings.filter((b) => b.status !== 'cancelled');
    const views = live.reduce((s, b) => s + N(b.impressions), 0); const reach = live.reduce((s, b) => s + N(b.reach), 0); const clicks = live.reduce((s, b) => s + N(b.clicks), 0);
    const byDay = {}; d.daily.forEach((x) => { const k = new Date(x.day).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + N(x.impressions); });
    const days = Object.keys(byDay).sort();
    const edit = canEdit('ads');
    return `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><button class="btn" id="back">← All customers</button><span class="av" style="background:${colorOf(c.name)};width:42px;height:42px;font-size:18px">${esc(c.name[0])}</span>
 <div style="min-width:0"><div style="font-family:var(--display);font-weight:700;font-size:20px">${esc(c.name)}</div><div class="small mu">${[c.kind, c.contact_name, c.phone, c.email, c.gst ? 'GST ' + c.gst : ''].filter(Boolean).map(esc).join(' · ')}</div></div><div style="flex:1"></div>
 <button class="btn" id="pdf">⤓ Report PDF</button><button class="btn" id="ppt">⤓ PowerPoint</button>${edit ? '<button class="btn" id="editCust">Edit</button><a class="btn pri" href="#book">+ New booking</a>' : ''}</div>
<div class="grid k4">${kpi('Total booked (incl. GST)', rs(c.booked), `${fmt(c.bookings)} bookings · ${fmt(c.hours)} hours`)}${kpi('Paid', rs(c.paid), '', 'up')}${kpi('To pay', N(c.due) ? rs(c.due) : 'Nothing due', '', N(c.due) ? 'wa' : 'up')}${kpi('Views · clicks', `${fmt(views)} · ${fmt(clicks)}`, `${fmt(reach)} people reached · ${views ? ((clicks / views) * 100).toFixed(1) : 0}% clicked`)}</div>
<div class="panel mt"><div class="tabs">${[['ads', 'Bookings & performance'], ['pay', 'Payments & invoices']].map(([k, t]) => `<button class="${k === tab ? 'on' : ''}" data-ctab="${k}">${t}</button>`).join('')}</div>
${tab === 'ads' ? `${d.bookings.length ? `<div class="tw"><table><tr><th>Ad</th><th>Where</th><th>Cities</th><th>Schedule</th><th class="n">Hours × rate</th><th class="n">Total</th><th class="n">Views</th><th class="n">Reach</th><th class="n">Clicks</th><th>Status</th><th></th></tr>
 ${d.bookings.map((b) => { const [s, k] = bkStatus(b); return `<tr><td><b>${esc(b.name)}</b><div class="small mu">Invoice ${b.invoice_no}</div></td><td>${PL[b.placement] || b.placement}</td><td>${b.cities.map(esc).join(', ')}</td>
  <td class="small">${dt(b.start_date)} · ${b.days} day${b.days > 1 ? 's' : ''}<br>${hrs(b.hours)}</td><td class="n">${fmt(b.hours_total)} × ${rs(b.rate)}</td><td class="n">${rs(b.total)}</td>
  <td class="n">${fmt(b.impressions)}</td><td class="n">${fmt(b.reach)}</td><td class="n">${fmt(b.clicks)}${N(b.impressions) ? `<div class="small mu">${((N(b.clicks) / N(b.impressions)) * 100).toFixed(1)}%</div>` : ''}</td>
  <td><span class="pill ${k}">${s}</span></td><td>${edit && b.status !== 'cancelled' ? `<select data-act="${b.id}" aria-label="Action"><option value="">…</option>${b.status === 'awaiting' ? '<option value="pay">Record payment</option>' : ''}${s === 'Paused' ? '<option value="resume">Resume</option>' : b.status === 'booked' && s !== 'Finished' ? '<option value="pause">Pause</option>' : ''}<option value="cancel">Cancel booking</option></select>` : ''}</td></tr>`; }).join('')}</table></div>` : '<div class="empty">No bookings yet.</div>'}
 ${days.length ? `<h3 class="mt">Views per day<span class="r">all bookings</span></h3>${columns(days.map((k) => ({ label: new Date(k + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: byDay[k] })), { h: 170, every: Math.max(1, Math.ceil(days.length / 10)), col: 'var(--accent2)' })}` : ''}
 ${d.viewers.total >= 10 ? `<h3 class="mt">Who saw these ads<span class="r">${fmt(d.viewers.total)} people · groups under 10 hidden</span></h3><div class="grid k3"><div>${bars(d.viewers.gender.map((x) => [x.key, x.n]), { col: 'var(--accent)' })}<div class="small mu">By gender</div></div><div>${bars(d.viewers.age.map((x) => [x.key, x.n]), { col: 'var(--accent2)' })}<div class="small mu">By age</div></div><div>${bars(d.viewers.city.map((x) => [x.key, x.n]), { col: 'var(--accent3)' })}<div class="small mu">By city</div></div></div>` : (views ? '<div class="small mu mt">Audience breakdown appears once at least 10 people have seen these ads.</div>' : '')}` : ''}
${tab === 'pay' ? `<h3>Invoices</h3><div class="tw"><table><tr><th>Invoice</th><th>Booking</th><th>Date</th><th class="n">Subtotal</th><th class="n">GST</th><th class="n">Total</th><th class="n">Paid</th><th></th></tr>
 ${d.bookings.filter((b) => b.status !== 'cancelled').map((b) => `<tr><td class="n" style="text-align:left">${b.invoice_no}</td><td>${esc(b.name)}</td><td>${dt(b.created_at)}</td><td class="n">${rs(b.subtotal)}</td><td class="n">${rs(b.gst)}</td><td class="n">${rs(b.total)}</td><td class="n">${rs(b.paid)}</td>
  <td><button class="btn sm" data-inv="${b.id}">⤓ Invoice</button> ${edit && N(b.paid) < N(b.total) ? `<button class="btn sm" data-pay="${b.id}">Record payment</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No invoices.</td></tr>'}</table></div>
 <h3 class="mt">Payments received</h3><div class="tw"><table><tr><th>Date</th><th class="n">Amount</th><th>How</th><th>Reference</th><th>Recorded by</th></tr>
 ${d.payments.map((p) => `<tr><td>${dt(p.paid_on)}</td><td class="n">${rs(p.amount)}</td><td>${esc(p.method)}</td><td class="small">${esc(p.reference || '—')}</td><td class="small mu">${esc(p.recorded_by || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No payments yet.</td></tr>'}</table></div>` : ''}
</div>`;
  }
  function payForm(bookingId) {
    const b = cur.bookings.find((x) => x.id === bookingId); const left = Math.max(0, N(b.total) - N(b.paid));
    C.modal(`Record payment · ${b.name}`, `<div class="form"><label>Amount (₹)<input id="p1" type="number" min="1" value="${left}" required></label><label>How<select id="p2"><option>UPI</option><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>Card</option></select></label>
      <label>Reference (UTR / cheque no.)<input id="p3" maxlength="80"></label><label>Date paid<input id="p4" type="date" value="${C.todayIST()}" required></label></div><p class="small mu">The ad goes live automatically once the booking is fully paid (₹${fmt(left)} left).</p>`,
    async () => { const r = await api('/ads/payments', { method: 'POST', body: { bookingId, amount: Number($('#p1').value), method: $('#p2').value, reference: $('#p3').value, paidOn: $('#p4').value } });
      toast(r.live ? 'Payment recorded. The ad is now live in its booked hours.' : 'Payment recorded.'); render(); }, 'Record payment');
  }
  function wireCustomer() {
    if (!st.cust || !cur) return;
    const back = $('#back'); if (back) back.onclick = () => { st.cust = null; render(); };
    document.querySelectorAll('[data-ctab]').forEach((b) => { b.onclick = () => { st.ctab = b.dataset.ctab; render(); }; });
    const e = $('#editCust'); if (e) e.onclick = () => customerForm(cur.customer);
    document.querySelectorAll('[data-pay]').forEach((b) => { b.onclick = () => payForm(b.dataset.pay); });
    document.querySelectorAll('[data-inv]').forEach((b) => { b.onclick = () => invoicePdf(cur.bookings.find((x) => x.id === b.dataset.inv)); });
    document.querySelectorAll('[data-act]').forEach((s) => { s.onchange = () => { const v = s.value; s.value = ''; if (!v) return; if (v === 'pay') return payForm(s.dataset.act);
      C.modal(v === 'cancel' ? 'Cancel this booking?' : v === 'pause' ? 'Pause this ad?' : 'Resume this ad?', `<p class="mu">${v === 'cancel' ? 'The ad stops and the booking is removed from what the customer owes.' : 'You can change this again any time.'}</p>`,
        async () => { await api(`/ads/bookings/${s.dataset.act}/${v}`, { method: 'POST' }); toast('Done'); render(); }, v === 'cancel' ? 'Cancel booking' : 'Confirm'); }; });
    const p = $('#pdf'); if (p) p.onclick = () => reportPdf(cur);
    const q = $('#ppt'); if (q) q.onclick = () => reportPpt(cur);
  }

  // ---------- reports ----------
  const ACC = [124, 77, 255]; const PINK = [229, 72, 127];
  function totals(d) { const b = d.bookings.filter((x) => x.status !== 'cancelled'); const v = b.reduce((s, x) => s + N(x.impressions), 0); const c = b.reduce((s, x) => s + N(x.clicks), 0);
    return { b, views: v, clicks: c, reach: b.reduce((s, x) => s + N(x.reach), 0), ctr: v ? ((c / v) * 100).toFixed(1) + '%' : '—' }; }
  const inr = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
  function reportPdf(d) {
    if (!window.jspdf) return toast('PDF maker is still loading. Try again in a moment.');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const c = d.customer; const t = totals(d); const W = 595;
    doc.setFillColor(21, 18, 42); doc.rect(0, 0, W, 90, 'F'); doc.setTextColor(255); doc.setFontSize(22); doc.text('Soulink · Ad performance report', 40, 48);
    doc.setFontSize(11); doc.setTextColor(200, 195, 230); doc.text(`${c.name}  ·  ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 40, 70);
    let y = 120; const box = (x, label, val) => { doc.setDrawColor(227, 224, 238); doc.roundedRect(x, y, 120, 58, 6, 6); doc.setTextColor(97, 92, 122); doc.setFontSize(9); doc.text(label, x + 10, y + 18); doc.setTextColor(23, 20, 42); doc.setFontSize(16); doc.text(String(val), x + 10, y + 42); };
    box(40, 'Views', fmt(t.views)); box(169, 'People reached', fmt(t.reach)); box(298, 'Clicks', fmt(t.clicks)); box(427, 'Click rate', t.ctr); y += 90;
    doc.setFontSize(13); doc.setTextColor(23, 20, 42); doc.text('Bookings', 40, y); y += 16;
    const head = ['Ad', 'Where', 'Cities', 'Dates', 'Hours', 'Views', 'Reach', 'Clicks']; const xs = [40, 150, 225, 300, 380, 420, 470, 520];
    doc.setFontSize(8.5); doc.setTextColor(143, 138, 168); head.forEach((h, i) => doc.text(h, xs[i], y)); y += 6; doc.setDrawColor(227, 224, 238); doc.line(40, y, 555, y); y += 14;
    doc.setTextColor(23, 20, 42);
    t.b.forEach((b) => { if (y > 770) { doc.addPage(); y = 50; }
      const row = [b.name.slice(0, 22), PL[b.placement] || b.placement, b.cities.join(', ').slice(0, 14), `${dt(b.start_date)} +${b.days}d`, String(b.hours_total), fmt(b.impressions), fmt(b.reach), fmt(b.clicks)];
      row.forEach((v, i) => doc.text(String(v), xs[i], y)); y += 8; doc.setTextColor(143, 138, 168); doc.text(`Hours each day: ${hrs(b.hours)}`, 40, y); doc.setTextColor(23, 20, 42); y += 16; });
    const byDay = {}; d.daily.forEach((x) => { const k = new Date(x.day).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + N(x.impressions); }); const days = Object.keys(byDay).sort();
    if (days.length) { if (y > 600) { doc.addPage(); y = 50; } y += 10; doc.setFontSize(13); doc.text('Views per day', 40, y); y += 14;
      const mx = Math.max(...days.map((k) => byDay[k]), 1); const bw = Math.min(30, 500 / days.length); const H = 120;
      days.forEach((k, i) => { const h = (byDay[k] / mx) * H; doc.setFillColor(...PINK); doc.rect(45 + i * bw, y + H - h, bw * 0.7, h, 'F'); if (days.length <= 16 || i % Math.ceil(days.length / 12) === 0) { doc.setFontSize(7); doc.setTextColor(143, 138, 168); doc.text(new Date(k + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), 45 + i * bw, y + H + 10); } });
      y += H + 30; doc.setTextColor(23, 20, 42); }
    if (d.viewers.total >= 10) { if (y > 660) { doc.addPage(); y = 50; } doc.setFontSize(13); doc.text('Who saw the ads', 40, y); y += 16; doc.setFontSize(9);
      [['Gender', d.viewers.gender], ['Age', d.viewers.age], ['City', d.viewers.city]].forEach(([title, g], col) => { let yy = y; doc.setTextColor(97, 92, 122); doc.text(title, 40 + col * 175, yy); yy += 12; doc.setTextColor(23, 20, 42);
        g.slice(0, 6).forEach((x) => { doc.text(`${x.key}: ${pct(x.n, d.viewers.total)}%`, 40 + col * 175, yy); yy += 12; }); }); y += 90; }
    if (y > 700) { doc.addPage(); y = 50; } doc.setFontSize(13); doc.text('Payments', 40, y); y += 16; doc.setFontSize(10);
    doc.text(`Booked: ${inr(c.booked)}    Paid: ${inr(c.paid)}    To pay: ${inr(c.due)}`, 40, y);
    doc.setFontSize(8); doc.setTextColor(143, 138, 168); doc.text('Views = times the ad was shown. Reach = different people who saw it. Groups under 10 people are not shown. QM46 Solutions Pvt Ltd · www.qm46.in', 40, 815);
    doc.save(`Soulink-ad-report-${c.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`); toast('Report PDF downloaded');
  }
  function invoicePdf(b) {
    if (!window.jspdf) return toast('PDF maker is still loading. Try again in a moment.');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const c = cur.customer;
    doc.setFontSize(20); doc.setTextColor(23, 20, 42); doc.text('Tax invoice', 40, 60); doc.setFontSize(10); doc.setTextColor(97, 92, 122);
    doc.text(['QM46 SOLUTIONS PRIVATE LIMITED', 'Flat No. 501, Plot No. 31 & 48, Sri Venkateshwara Nilyam,', 'L B Nagar, Hyderabad 500074, Telangana, India', 'quantum46solutions@gmail.com'], 40, 84);
    doc.text([`Invoice no: ${b.invoice_no}`, `Date: ${dt(b.created_at)}`], 400, 84);
    doc.setTextColor(23, 20, 42); doc.setFontSize(11); doc.text('Bill to', 40, 160); doc.setFontSize(10); doc.text([c.name, c.address || '', c.gst ? `GSTIN: ${c.gst}` : '', c.phone || ''].filter(Boolean), 40, 176);
    let y = 250; doc.setDrawColor(227, 224, 238); doc.line(40, y, 555, y); y += 18; doc.setFontSize(10);
    doc.text(`Soulink ad · ${b.name}`, 40, y); y += 14; doc.setTextColor(97, 92, 122);
    doc.text([`${PL[b.placement] || b.placement} · ${b.cities.join(', ')}`, `${dt(b.start_date)} for ${b.days} day(s) · hours each day: ${hrs(b.hours)}`, `${b.hours_total} hours × ${inr(b.rate)} per hour (city and peak-hour rates applied)`], 40, y);
    y += 60; doc.setTextColor(23, 20, 42); const r = (l, v, bold) => { doc.setFontSize(bold ? 12 : 10); doc.text(l, 360, y); doc.text(v, 555, y, { align: 'right' }); y += 18; };
    r('Subtotal', inr(b.subtotal)); r('GST', inr(b.gst)); doc.line(360, y - 8, 555, y - 8); r('Total', inr(b.total), true); r('Paid', inr(b.paid)); r('Balance', inr(Math.max(0, N(b.total) - N(b.paid))), true);
    doc.setFontSize(8); doc.setTextColor(143, 138, 168); doc.text('The ad runs only in the booked hours and cities, and goes live once fully paid.', 40, 800);
    doc.save(`Soulink-invoice-${b.invoice_no}.pdf`); toast('Invoice downloaded');
  }
  function reportPpt(d) {
    if (!window.PptxGenJS) return toast('PowerPoint maker is still loading. Try again in a moment.');
    const p = new window.PptxGenJS(); p.layout = 'LAYOUT_WIDE'; const c = d.customer; const t = totals(d);
    const dark = '15122A'; const vio = '7C4DFF'; const pink = 'E5487F'; const ink = '17142A'; const mute = '615C7A';
    let s = p.addSlide(); s.background = { color: dark };
    s.addText('Soulink · Ad performance', { x: 0.7, y: 1.8, w: 11, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
    s.addText(c.name, { x: 0.7, y: 2.9, w: 11, h: 0.6, fontSize: 24, color: 'C9B8FF' });
    s.addText(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), { x: 0.7, y: 3.6, w: 11, h: 0.5, fontSize: 14, color: 'A7A1C6' });
    s = p.addSlide(); s.addText('Summary', { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 28, bold: true, color: ink });
    [['Views', fmt(t.views)], ['People reached', fmt(t.reach)], ['Clicks', fmt(t.clicks)], ['Click rate', t.ctr]].forEach(([l, v], i) => {
      s.addShape(p.ShapeType.roundRect, { x: 0.6 + i * 3.1, y: 1.5, w: 2.9, h: 1.6, fill: { color: 'F0EEF7' }, line: { color: 'E3E0EE' }, rectRadius: 0.1 });
      s.addText(l, { x: 0.8 + i * 3.1, y: 1.65, w: 2.6, h: 0.4, fontSize: 13, color: mute }); s.addText(v, { x: 0.8 + i * 3.1, y: 2.1, w: 2.6, h: 0.8, fontSize: 30, bold: true, color: ink }); });
    s.addText(`${t.b.length} booking(s) · Booked ${inr(c.booked)} · Paid ${inr(c.paid)} · To pay ${inr(c.due)}`, { x: 0.6, y: 3.5, w: 12, h: 0.5, fontSize: 14, color: mute });
    const byDay = {}; d.daily.forEach((x) => { const k = new Date(x.day).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + N(x.impressions); }); const days = Object.keys(byDay).sort();
    if (days.length) s.addChart(p.ChartType.bar, [{ name: 'Views', labels: days.map((k) => new Date(k + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), values: days.map((k) => byDay[k]) }],
      { x: 0.6, y: 4.1, w: 12, h: 3.1, barDir: 'col', chartColors: [pink], showValue: false, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, showTitle: true, title: 'Views per day', titleFontSize: 13 });
    t.b.forEach((b) => { s = p.addSlide(); s.addText(b.name, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ink });
      s.addText(`${PL[b.placement] || b.placement} · ${b.cities.join(', ')} · ${dt(b.start_date)} for ${b.days} day(s) · hours: ${hrs(b.hours)}`, { x: 0.6, y: 1.05, w: 12, h: 0.5, fontSize: 13, color: mute });
      [['Views', fmt(b.impressions)], ['Reach', fmt(b.reach)], ['Clicks', fmt(b.clicks)], ['Click rate', N(b.impressions) ? ((N(b.clicks) / N(b.impressions)) * 100).toFixed(1) + '%' : '—']].forEach(([l, v], i) => {
        s.addText(l, { x: 0.6 + i * 3.1, y: 1.9, w: 2.9, h: 0.4, fontSize: 13, color: mute }); s.addText(v, { x: 0.6 + i * 3.1, y: 2.3, w: 2.9, h: 0.8, fontSize: 32, bold: true, color: vio }); });
      const dd = d.daily.filter((x) => String(x.ad_id).toLowerCase() === String(b.campaign_id).toLowerCase()).sort((a, z) => new Date(a.day) - new Date(z.day));
      if (dd.length) s.addChart(p.ChartType.bar, [{ name: 'Views', labels: dd.map((x) => new Date(x.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), values: dd.map((x) => N(x.impressions)) }, { name: 'Clicks', labels: dd.map((x) => new Date(x.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), values: dd.map((x) => N(x.clicks)) }],
        { x: 0.6, y: 3.4, w: 12, h: 3.8, barDir: 'col', chartColors: [vio, pink], showLegend: true, legendPos: 'b', catAxisLabelFontSize: 10, valAxisLabelFontSize: 10 }); });
    if (d.viewers.total >= 10) { s = p.addSlide(); s.addText('Who saw the ads', { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 28, bold: true, color: ink });
      [['Gender', d.viewers.gender, vio], ['Age', d.viewers.age, pink], ['City', d.viewers.city, '0EA5A4']].forEach(([title, g, col], i) => {
        if (g.length) s.addChart(p.ChartType.bar, [{ name: title, labels: g.slice(0, 6).map((x) => x.key), values: g.slice(0, 6).map((x) => x.n) }], { x: 0.4 + i * 4.2, y: 1.3, w: 4, h: 5.6, barDir: 'bar', chartColors: [col], showTitle: true, title, titleFontSize: 14, catAxisLabelFontSize: 11, valAxisHidden: true, showValue: true, dataLabelFontSize: 10 }); });
      s.addText('Groups under 10 people are not shown.', { x: 0.6, y: 7, w: 12, h: 0.3, fontSize: 10, color: mute }); }
    p.writeFile({ fileName: `Soulink-ad-report-${c.name.replace(/[^a-z0-9]+/gi, '-')}.pptx` }).then(() => toast('PowerPoint downloaded'));
  }

  // ---------- new booking ----------
  let card = null;
  const bk = { customerId: '', name: '', placement: 'feed', cities: ['Hyderabad'], startDate: '', days: 1, hours: [19, 20, 21, 22], brand: '', headline: '', body: '', ctaLabel: 'Reach out', ctaUrl: '' };
  function quote() { const rate = N(card.rates?.[bk.placement]); const mult = bk.cities.reduce((s, c) => s + (card.cities?.[c] ?? 1), 0); const peak = bk.hours.filter((h) => (card.peakHours || []).includes(h)).length;
    const total = bk.hours.length * bk.days; const sub = Math.round(total * rate * mult + peak * bk.days * rate * mult * N(card.peakExtra)); const gst = Math.round(sub * N(card.gst)); return { rate, mult, total, peak: peak * bk.days, sub, gst }; }
  VIEWS.book = async () => {
    const [cs, rc] = await Promise.all([api('/ads/customers'), api('/ads/settings')]); card = rc.card; if (!bk.startDate) bk.startDate = C.todayIST();
    if (st.cust && !bk.customerId) bk.customerId = st.cust; if (!bk.customerId && cs.customers[0]) bk.customerId = cs.customers[0].id;
    st.bookCustomers = cs.customers;
    if (!cs.customers.length) return `<div class="panel"><div class="empty">Add a customer first. <a href="#ads">Go to Ads & customers</a></div></div>`;
    return `<div class="grid c21"><div class="panel"><form id="bf" class="form">
 <label>Customer<select id="b1">${cs.customers.map((c) => `<option value="${c.id}" ${c.id === bk.customerId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
 <label>Booking name<input id="b2" required maxlength="120" placeholder="Diwali offer" value="${esc(bk.name)}"></label>
 <div class="full"><div class="small mu" style="margin-bottom:6px">Where the ad shows</div><div class="chips">${Object.entries(PL).map(([k, t]) => `<button type="button" class="chip ${k === bk.placement ? 'on' : ''}" data-pl="${k}">${t} · ${rs(card.rates?.[k])}/h</button>`).join('')}<button type="button" class="chip" disabled title="Needs the next app version">In stories · coming next version</button></div></div>
 <div class="full"><div class="small mu" style="margin-bottom:6px">Cities</div><div class="chips">${Object.entries(card.cities || {}).map(([c, m]) => `<button type="button" class="chip ${bk.cities.includes(c) ? 'on' : ''}" data-city="${esc(c)}">${esc(c)}${m !== 1 ? ` ×${m}` : ''}</button>`).join('')}</div></div>
 <label>Start date<input id="b3" type="date" required value="${bk.startDate}"></label><label>Number of days<input id="b4" type="number" min="1" max="90" required value="${bk.days}"></label>
 <div class="full"><div class="small mu" style="margin-bottom:6px">Hours each day (Indian time). Dashed = peak hours (+${Math.round(N(card.peakExtra) * 100)}%).</div>
  <div class="tw"><div class="hours" style="min-width:560px"><div></div>${Array.from({ length: 24 }, (_, h) => `<div style="text-align:center">${h % 3 === 0 ? h : ''}</div>`).join('')}<div>Hours</div>${Array.from({ length: 24 }, (_, h) => `<button type="button" class="h ${bk.hours.includes(h) ? 'on' : ''} ${(card.peakHours || []).includes(h) ? 'pk' : ''}" data-hr="${h}" aria-label="${h}:00" title="${h}:00–${h + 1}:00"></button>`).join('')}</div></div>
  <div class="chips mt"><button type="button" class="chip" data-pre="all">Full 24 hours</button><button type="button" class="chip" data-pre="eve">Evening 7–11 pm</button><button type="button" class="chip" data-pre="morn">Morning 6–9 am</button><button type="button" class="chip" data-pre="lunch">Lunch 12–3 pm</button><button type="button" class="chip" data-pre="none">Clear</button></div></div>
 <div class="full" style="border-top:1px solid var(--line);padding-top:12px"><b>The ad</b></div>
 <label>Brand name shown<input id="b5" required maxlength="80" value="${esc(bk.brand)}"></label><label>Headline<input id="b6" required maxlength="120" value="${esc(bk.headline)}"></label>
 <label class="full">Text (optional)<textarea id="b7" rows="2" maxlength="400">${esc(bk.body)}</textarea></label>
 <label>Button label<input id="b8" maxlength="30" value="${esc(bk.ctaLabel)}"></label><label>Button link (website, optional)<input id="b9" type="url" placeholder="https://" value="${esc(bk.ctaUrl)}"></label>
 <label class="full">Picture (JPG or PNG, up to 8 MB)<input id="b10" type="file" accept="image/jpeg,image/png,image/webp"></label>
</form></div><div class="panel" style="align-self:start;position:sticky;top:12px"><h3>Price</h3><div id="pq"></div><button class="btn pri mt" id="bgo" style="width:100%;justify-content:center">Create booking & invoice</button><div class="small mu mt">The ad goes live only after the payment is recorded, and shows only in the booked hours and cities.</div></div></div>`;
  };
  function drawQuote() { const q = quote(); const el = $('#pq'); if (!el) return;
    el.innerHTML = `<div class="price"><span>${bk.hours.length} h/day × ${bk.days} day(s)</span><b>${q.total} hours</b></div><div class="price"><span>Rate (${PL[bk.placement]})</span><b>${rs(q.rate)} / hour</b></div>
      <div class="price"><span>Cities (${bk.cities.map(esc).join(', ') || 'none'})</span><b>× ${q.mult.toFixed(1)}</b></div><div class="price"><span>Peak hours (${q.peak} h)</span><b>+${Math.round(N(card.peakExtra) * 100)}%</b></div>
      <div class="price"><span>Subtotal</span><b>${rs(q.sub)}</b></div><div class="price"><span>GST ${Math.round(N(card.gst) * 100)}%</span><b>${rs(q.gst)}</b></div><div class="price tot"><span>Total</span><span>${rs(q.sub + q.gst)}</span></div>`;
    $('#bgo').disabled = !(q.total && bk.cities.length); }
  AFTER.book = () => {
    if (!$('#bf')) return; drawQuote();
    const keep = () => { bk.customerId = $('#b1').value; bk.name = $('#b2').value; bk.startDate = $('#b3').value; bk.days = Math.max(1, Math.min(90, Number($('#b4').value) || 1)); bk.brand = $('#b5').value; bk.headline = $('#b6').value; bk.body = $('#b7').value; bk.ctaLabel = $('#b8').value; bk.ctaUrl = $('#b9').value; };
    $('#bf').addEventListener('input', () => { keep(); drawQuote(); });
    $('#b1').onchange = () => { keep(); const c = st.bookCustomers.find((x) => x.id === bk.customerId); if (c && !bk.brand) { bk.brand = c.name; $('#b5').value = c.name; } };
    if (!bk.brand) { const c = st.bookCustomers.find((x) => x.id === bk.customerId); if (c) { bk.brand = c.name; $('#b5').value = c.name; } }
    const rerender = () => { keep(); render(); };
    document.querySelectorAll('[data-pl]').forEach((b) => { b.onclick = () => { bk.placement = b.dataset.pl; rerender(); }; });
    document.querySelectorAll('[data-city]').forEach((b) => { b.onclick = () => { const c = b.dataset.city; bk.cities = bk.cities.includes(c) ? bk.cities.filter((x) => x !== c) : [...bk.cities, c]; rerender(); }; });
    document.querySelectorAll('[data-hr]').forEach((b) => { b.onclick = () => { const h = Number(b.dataset.hr); bk.hours = bk.hours.includes(h) ? bk.hours.filter((x) => x !== h) : [...bk.hours, h]; b.classList.toggle('on'); drawQuote(); }; });
    document.querySelectorAll('[data-pre]').forEach((b) => { b.onclick = () => { bk.hours = { all: [...Array(24).keys()], eve: [19, 20, 21, 22], morn: [6, 7, 8], lunch: [12, 13, 14], none: [] }[b.dataset.pre]; rerender(); }; });
    $('#bgo').onclick = async () => { keep(); const f = $('#bf'); if (!f.reportValidity()) return;
      const fd = new FormData(); ['customerId', 'name', 'placement', 'startDate', 'days', 'brand', 'headline', 'body', 'ctaLabel', 'ctaUrl'].forEach((k) => fd.append(k, bk[k] ?? ''));
      fd.append('cities', bk.cities.join(',')); fd.append('hours', bk.hours.join(',')); const file = $('#b10').files[0]; if (file) fd.append('image', file);
      $('#bgo').disabled = true;
      try { const r = await api('/ads/bookings', { method: 'POST', form: fd }); toast(`Booking created · invoice ${r.invoiceNo} · ${rs(r.total)}. Record the payment to make it live.`);
        st.cust = bk.customerId; st.ctab = 'pay'; Object.assign(bk, { name: '', headline: '', body: '', ctaUrl: '' }); location.hash = 'ads'; }
      catch (x) { toast(x.message); $('#bgo').disabled = false; } };
  };

  // ---------- rate card ----------
  VIEWS.rates = async () => {
    const c = (await api('/ads/settings')).card; card = c; const edit = canEdit();
    return `<div class="grid k2"><div class="panel"><h3>Price per hour</h3><form id="rf" class="form">
 ${Object.entries(PL).map(([k, t]) => `<label>${t} (₹/hour)<input type="number" min="0" data-rate="${k}" value="${N(c.rates?.[k])}" ${edit ? '' : 'disabled'}></label>`).join('')}
 <label>Peak hours extra (%)<input type="number" min="0" max="300" id="r1" value="${Math.round(N(c.peakExtra) * 100)}" ${edit ? '' : 'disabled'}></label><label>GST (%)<input type="number" min="0" max="50" id="r2" value="${Math.round(N(c.gst) * 100)}" ${edit ? '' : 'disabled'}></label>
 <label class="full">Peak hours (comma separated, 0–23)<input id="r3" value="${(c.peakHours || []).join(', ')}" ${edit ? '' : 'disabled'}></label></form></div>
<div class="panel"><h3>City price multiplier<span class="r">1 = full price</span></h3><div class="tw"><table id="ct"><tr><th>City</th><th class="n">Multiplier</th><th></th></tr>
 ${Object.entries(c.cities || {}).map(([k, v]) => `<tr><td><input data-cn value="${esc(k)}" ${edit ? '' : 'disabled'}></td><td class="n"><input data-cm type="number" step="0.1" min="0.1" max="5" value="${v}" style="width:80px" ${edit ? '' : 'disabled'}></td><td>${edit ? '<button type="button" class="btn sm" data-rm>Remove</button>' : ''}</td></tr>`).join('')}</table></div>
 ${edit ? '<button type="button" class="btn sm mt" id="addCity">+ Add city</button>' : ''}</div></div>
${edit ? '<div class="mt"><button class="btn pri" id="saveRates">Save rate card</button></div>' : '<p class="small mu mt">Only owners can change prices.</p>'}`;
  };
  AFTER.rates = () => {
    const a = $('#addCity'); if (a) a.onclick = () => { const tr = document.createElement('tr'); tr.innerHTML = '<td><input data-cn placeholder="City"></td><td class="n"><input data-cm type="number" step="0.1" min="0.1" max="5" value="1" style="width:80px"></td><td><button type="button" class="btn sm" data-rm>Remove</button></td>'; $('#ct').appendChild(tr); wireRm(); };
    const wireRm = () => document.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => b.closest('tr').remove(); }); wireRm();
    const s = $('#saveRates'); if (s) s.onclick = async () => {
      const rates = {}; document.querySelectorAll('[data-rate]').forEach((i) => { rates[i.dataset.rate] = Number(i.value) || 0; });
      const cities = {}; document.querySelectorAll('#ct tr').forEach((tr) => { const n = tr.querySelector('[data-cn]')?.value.trim(); const m = Number(tr.querySelector('[data-cm]')?.value); if (n) cities[n] = m || 1; });
      const peakHours = $('#r3').value.split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 23);
      try { await api('/ads/settings', { method: 'PUT', body: { rates, cities, peakHours, peakExtra: (Number($('#r1').value) || 0) / 100, gst: (Number($('#r2').value) || 0) / 100 } }); toast('Rate card saved. New bookings use these prices.'); render(); } catch (x) { toast(x.message); } };
  };
})();
