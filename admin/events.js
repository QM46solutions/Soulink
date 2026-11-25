// Soul Events: create and publish events, see registrations and payments, check people in at the gate.
(function () {
  const { fmt, esc } = window.Charts;
  const C = window.__console; const { api, apiBlob, VIEWS, AFTER, st, kpi, rs, N, dtt, toast, render, canEdit, $ } = C;
  const KIND = { pub: 'Pub night', run: 'Run / marathon', sport: 'Sport / tournament', music: 'Music', social: 'Social', workshop: 'Workshop' };
  const STATUS = { draft: ['Draft · not visible', 'p-dim'], published: ['Live in the app', 'p-good'], closed: ['Registrations closed', 'p-warn'], cancelled: ['Cancelled', 'p-bad'] };
  const PAY = { 'razorpay': ['Razorpay live', 'p-good'], 'razorpay-test': ['Razorpay TEST keys', 'p-warn'], 'not-set-up': ['Not set up yet', 'p-warn'] };
  // datetime-local wants "2026-12-06T19:00" in Indian time
  const localIST = (d) => (d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 16) : '');
  const when = (e) => new Date(e.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  VIEWS.events = async () => {
    if (st.ev) return eventView();
    const d = await api('/events'); st.evList = d.events;
    const ev = d.events; const live = ev.filter((e) => e.status === 'published');
    const sold = ev.reduce((s, e) => s + N(e.sold), 0); const rev = ev.reduce((s, e) => s + N(e.revenue), 0);
    const [pt, pk] = PAY[d.payments] || PAY['not-set-up'];
    const edit = canEdit('ads');
    return `<div class="grid k4">${kpi('Events live in the app', fmt(live.length), `${fmt(ev.length)} in total`)}${kpi('Tickets sold', fmt(sold), '')}${kpi('Money in (Razorpay live)', rs(rev), 'incl. GST', 'up')}${kpi('Payments', `<span class="pill ${pk}" style="font-size:13px">${pt}</span>`, d.payments === 'not-set-up' ? 'Team can test-pay. Add the Razorpay keys in Render to go live.' : d.payments === 'razorpay-test' ? 'No real money yet' : '')}</div>
<div class="panel mt"><h3>Events<span class="r">${edit ? '<button class="btn sm pri" id="addEv">+ New event</button>' : ''}<button class="btn sm" id="gate">⌁ Gate check-in</button></span></h3>
${ev.length ? `<div class="tw"><table><tr><th>Event</th><th>When (IST)</th><th>Where</th><th class="n">Price</th><th class="n">Sold / seats</th><th class="n">Checked in</th><th>Status</th></tr>
${ev.map((e) => { const [s, k] = STATUS[e.status] || [e.status, 'p-dim']; return `<tr class="click" data-ev="${e.id}"><td><b>${esc(e.title)}</b><div class="small mu">${KIND[e.kind] || e.kind}${e.minAge ? ` · ${e.minAge}+` : ''}</div></td>
 <td>${when(e)}</td><td>${esc(e.venue)}<div class="small mu">${esc(e.city)}</div></td><td class="n">${e.price ? rs(e.price) : 'Free'}</td><td class="n">${fmt(e.sold)} / ${fmt(e.capacity)}</td><td class="n">${fmt(e.checkedIn)}</td>
 <td><span class="pill ${k}">${s}</span>${e.ended ? ' <span class="pill p-dim">Over</span>' : ''}</td></tr>`; }).join('')}</table></div>`
  : `<div class="empty">No events yet.${edit ? ' Create one, check it, then Publish so it shows under Soul Events in the app.' : ''}</div>`}
<p class="small mu">New events start as drafts. Publish to show them in the app. Click an event to see who registered, paid and checked in.</p></div>`;
  };
  AFTER.events = () => {
    document.querySelectorAll('[data-ev]').forEach((r) => { r.onclick = () => { st.ev = r.dataset.ev; render(); }; });
    const a = $('#addEv'); if (a) a.onclick = () => eventForm();
    const g = $('#gate'); if (g) g.onclick = () => gate(st.ev || null);
    const b = $('#evBack'); if (b) b.onclick = () => { st.ev = null; render(); };
    const e = $('#evEdit'); if (e) e.onclick = () => eventForm(st.evCur);
    document.querySelectorAll('[data-evst]').forEach((x) => { x.onclick = async () => {
      const s = x.dataset.evst; const msg = { published: 'Publish this event? It shows in the app straight away.', closed: 'Stop new registrations? Paid tickets stay valid.', cancelled: 'Cancel this event? It shows as cancelled in the app. Refund paid people from the Razorpay dashboard.', draft: 'Hide this event from the app?' }[s];
      if (!confirm(msg)) return;
      try { await api(`/events/${st.ev}/status`, { method: 'POST', body: { status: s } }); toast('Saved'); render(); } catch (err) { toast(err.message); } }; });
    document.querySelectorAll('[data-reg]').forEach((x) => { x.onclick = () => regDetails(x.dataset.reg); });
    document.querySelectorAll('[data-ci]').forEach((x) => { x.onclick = async (ev) => { ev.stopPropagation(); await doCheckIn(x.dataset.ci, st.ev); render(); }; });
  };

  async function eventView() {
    const d = await api('/events/' + st.ev); const e = d.event; st.evCur = d.event; const [s, k] = STATUS[e.status] || [e.status, 'p-dim'];
    const edit = canEdit('ads'); const people = canEdit('support');
    const act = edit ? (e.status === 'draft' ? '<button class="btn pri" data-evst="published">Publish</button>'
      : e.status === 'published' ? '<button class="btn" data-evst="closed">Close registrations</button><button class="btn" data-evst="draft">Unpublish</button>'
        : e.status === 'closed' ? '<button class="btn pri" data-evst="published">Reopen</button>' : '') + (e.status !== 'cancelled' ? '<button class="btn" data-evst="cancelled">Cancel event</button>' : '') : '';
    const list = d.attendees; const paid = list.filter((a) => a.status === 'paid');
    return `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><button class="btn" id="evBack">← All events</button>
 <div style="min-width:0"><div style="font-family:var(--display);font-weight:700;font-size:20px">${esc(e.title)} <span class="pill ${k}">${s}</span></div>
 <div class="small mu">${KIND[e.kind] || e.kind} · ${when(e)} · ${esc(e.venue)}, ${esc(e.city)} · ${e.price ? rs(e.price) : 'Free'}${e.minAge ? ` · ${e.minAge}+` : ''}</div></div><div style="flex:1"></div>
 <button class="btn" id="gate">⌁ Gate check-in</button>${edit ? '<button class="btn" id="evEdit">Edit</button>' : ''}${act}</div>
${e.coverUrl ? `<img src="${esc(C.fileUrl ? C.fileUrl(e.coverUrl) : (window.SOULINK_API || '') + e.coverUrl)}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-bottom:14px">` : ''}
<div class="grid k4">${kpi('Paid tickets', `${fmt(paid.length)} / ${fmt(e.capacity)}`, `${fmt(e.seatsLeft)} seats left`)}${kpi('Checked in', fmt(paid.filter((a) => a.checkedInAt).length), paid.length ? `${Math.round((paid.filter((a) => a.checkedInAt).length / paid.length) * 100)}% of paid` : '')}${kpi('Waiting to pay', fmt(list.length - paid.length), 'registered, not paid')}${kpi('Money in', rs(paid.filter((a) => a.payMode === 'live').reduce((t, a) => t + N(a.amount), 0)), 'Razorpay live')}</div>
<div class="panel mt"><h3>Registrations<span class="r small mu">${people ? 'Click a name for address and ID proof' : ''}</span></h3>
${list.length ? `<div class="tw"><table><tr><th>Name</th><th>Phone</th><th>ID</th><th>Paid</th><th>Ticket</th><th>Checked in</th><th></th></tr>
${list.map((a) => `<tr ${people ? `class="click" data-reg="${a.id}"` : ''}><td><b>${esc(a.name)}</b><div class="small mu">@${esc(a.username || '')}</div></td><td>${esc(a.phone)}</td><td class="small">${esc(a.idType || '')}${a.hasId ? '' : ' <span class="mu">(removed)</span>'}</td>
 <td>${a.status === 'paid' ? `<span class="pill ${a.payMode === 'live' ? 'p-good' : 'p-acc'}">${a.payMode === 'live' ? rs(a.amount) : a.payMode === 'free' ? 'Free' : 'Test'}</span>` : '<span class="pill p-warn">Not paid</span>'}</td>
 <td class="small" style="font-family:var(--mono)">${a.code || '—'}</td><td class="small">${a.checkedInAt ? `✓ ${dtt(a.checkedInAt)}<div class="mu">${esc(a.checkedInBy || '')}</div>` : '—'}</td>
 <td>${a.status === 'paid' && !a.checkedInAt && a.code ? `<button class="btn sm" data-ci="${a.code}">Check in</button>` : ''}</td></tr>`).join('')}</table></div>` : '<div class="empty">Nobody has registered yet.</div>'}
<p class="small mu">ID proofs are deleted automatically 30 days after the event. Opening someone's details is recorded in Team &amp; access.</p></div>
${e.description ? `<div class="panel mt"><h3>About</h3><p style="white-space:pre-wrap;line-height:1.6">${esc(e.description)}</p></div>` : ''}`;
  }

  function eventForm(e) {
    const r = e?.raw || {};
    C.modal(e ? 'Edit event' : 'New event', `<div class="form">
 <label class="full">Event name<input id="f1" required maxlength="120" placeholder="Soul Pub · Friday night" value="${esc(e?.title || '')}"></label>
 <label>Type<select id="f2">${Object.entries(KIND).map(([k, t]) => `<option value="${k}" ${e?.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
 <label>Minimum age (optional)<input id="f3" type="number" min="0" max="99" placeholder="e.g. 21 for a pub" value="${e?.minAge ?? ''}"></label>
 <label class="full">One-line pitch<input id="f4" maxlength="200" placeholder="Meet people who think like you, over drinks and music" value="${esc(e?.tagline || '')}"></label>
 <label class="full">Details (what's included, dress code, rules)<textarea id="f5" rows="5" maxlength="3000">${esc(e?.description || '')}</textarea></label>
 <label>Venue<input id="f6" required maxlength="200" value="${esc(e?.venue || '')}"></label><label>City<input id="f7" required maxlength="60" value="${esc(e?.city || 'Hyderabad')}"></label>
 <label class="full">Google Maps link (optional)<input id="f8" type="url" maxlength="500" value="${esc(e?.mapUrl || '')}"></label>
 <label>Starts (IST)<input id="f9" type="datetime-local" required value="${localIST(r.startsAt || e?.startsAt)}"></label><label>Ends (IST, optional)<input id="f10" type="datetime-local" value="${localIST(r.endsAt || e?.endsAt)}"></label>
 <label>Ticket price ₹ (incl. GST, 0 = free)<input id="f11" type="number" min="0" step="1" required value="${e?.price ?? ''}"></label><label>Seats<input id="f12" type="number" min="1" step="1" required value="${e?.capacity ?? ''}"></label>
 <label class="full">Cover picture (wide, optional)<input id="f13" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
 <p class="small mu">${e ? 'Changes show in the app straight away.' : 'It is saved as a draft. Publish it from the event page when it looks right.'}</p>`,
    async () => {
      const fd = new FormData();
      [['title', 'f1'], ['kind', 'f2'], ['minAge', 'f3'], ['tagline', 'f4'], ['description', 'f5'], ['venue', 'f6'], ['city', 'f7'], ['mapUrl', 'f8'], ['startsAt', 'f9'], ['endsAt', 'f10'], ['price', 'f11'], ['capacity', 'f12']]
        .forEach(([k, id]) => fd.append(k, $('#' + id).value));
      const f = $('#f13').files[0]; if (f) fd.append('cover', f);
      if (e) { await api('/events/' + e.id, { method: 'PATCH', form: fd }); toast('Event saved'); }
      else { const x = await api('/events', { method: 'POST', form: fd }); st.ev = x.id; toast('Draft saved. Check it, then Publish.'); }
      render();
    }, e ? 'Save' : 'Create draft');
  }

  async function regDetails(id) {
    try {
      const d = await api('/events/registrations/' + id);
      C.modal(d.name, `<p><b>Phone:</b> ${esc(d.phone)}</p><p><b>Address:</b> ${esc(d.address)}</p><p><b>ID:</b> ${esc(d.idType || '')}</p>
        <div id="idp" class="small mu">${d.hasId ? 'Loading ID proof…' : 'ID proof was removed (30 days after the event).'}</div>`, null);
      if (d.hasId) {
        const b = await apiBlob(`/events/registrations/${id}/id-proof`); const u = URL.createObjectURL(b); const el = $('#idp'); if (!el) return;
        el.innerHTML = b.type === 'application/pdf' ? `<a class="btn" href="${u}" target="_blank" rel="noopener">Open the ID (PDF)</a>` : `<img src="${u}" alt="ID proof" style="max-width:100%;max-height:60vh;border-radius:10px;display:block">`;
      }
    } catch (x) { toast(x.message); }
  }

  const RES = { ok: ['✓ Welcome in', 'p-good'], already: ['Already checked in', 'p-bad'], unpaid: ['Not paid', 'p-bad'], wrong_event: ['Ticket is for another event', 'p-bad'], invalid: ['Not a valid ticket', 'p-bad'] };
  async function doCheckIn(code, eventId) {
    const r = await api('/events/check-in', { method: 'POST', body: { code, ...(eventId ? { eventId } : {}) } });
    const [t] = RES[r.result] || [r.result]; toast(`${t}${r.name ? ' · ' + r.name : ''}`); return r;
  }
  // gate: the laptop / phone camera reads the QR where the browser can (Chrome), otherwise type the code
  function gate(eventId) {
    const cam = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
    C.modal('Gate check-in', `${cam ? '<video id="gv" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:46vh"></video>' : '<p class="small mu">This browser can’t read QR codes: type the code under the QR (SL…), or use the Soulink app’s scanner.</p>'}
      <div class="form" style="margin-top:10px"><label class="full">Ticket code<input id="gc" placeholder="SL…" autocomplete="off" style="font-family:var(--mono);text-transform:uppercase"></label></div>
      <div id="gr" style="margin-top:10px;font-size:16px"></div>`, async () => { await show($('#gc').value); throw new Error(''); }, 'Check in');
    const out = $('#gr'); let busy = false; let stream = null; let last = '';
    async function show(text) {
      if (!text || busy) return; busy = true;
      try { const r = await doCheckIn(text, eventId); const [t, k] = RES[r.result] || [r.result, 'p-dim'];
        out.innerHTML = `<span class="pill ${k}" style="font-size:15px;padding:6px 12px">${t}</span> <b>${esc(r.name || '')}</b> <span class="small mu">${esc(r.event || '')}${r.checkedInAt && r.result === 'already' ? ' · at ' + dtt(r.checkedInAt) : ''}</span>`; $('#gc').value = ''; }
      catch (x) { out.textContent = x.message; } finally { setTimeout(() => { busy = false; }, 1500); }
    }
    if (cam) {
      const det = new window.BarcodeDetector({ formats: ['qr_code'] }); const v = $('#gv');
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => { stream = s; v.srcObject = s; v.play(); tick(); }).catch(() => { v.replaceWith(Object.assign(document.createElement('p'), { className: 'small mu', textContent: 'Camera not allowed: type the code instead.' })); });
      const tick = async () => { if (!document.body.contains(v)) { stream?.getTracks().forEach((t) => t.stop()); return; }
        try { const c = await det.detect(v); const raw = c[0]?.rawValue; if (raw && raw !== last) { last = raw; setTimeout(() => { last = ''; }, 4000); await show(raw); } } catch { /* frame not ready */ }
        setTimeout(tick, 350); };
    }
  }
})();
