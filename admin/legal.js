// Console page: Legal. Complaints to the Grievance Officer, police / court / government orders, and bans.
// Deadlines come from India's IT Rules 2021 (amended Feb 2026) and the DPDP Rules 2025.
(function () {
  const { fmt, esc } = window.Charts;
  const C = window.__console; const { api, VIEWS, AFTER, kpi, N, dtt, ago, toast, render, $ } = C;
  const me = () => C.me();
  const SRC = { court: 'Court', government: 'Government (s.79(3)(b) notice)', police: 'Police / investigating agency', cert_in: 'CERT-In', other: 'Other authority' };
  const KIND = { takedown: 'Remove content (3 hours)', preserve: 'Keep records / preserve (3 hours)', info_request: 'Give user information (72 hours)' };
  const STATUS = { open: ['Open', 'p-warn'], in_progress: ['Working on it', 'p-acc'], resolved: ['Resolved', 'p-good'], rejected: ['No action', 'p-dim'], done: ['Done', 'p-good'] };

  // time left until a deadline: "3 h 20 m left" / "5 h late"
  function left(due) {
    const ms = new Date(due) - Date.now(); const a = Math.abs(ms);
    const t = a >= 86400000 ? `${Math.floor(a / 86400000)} d ${Math.floor((a % 86400000) / 3600000)} h` : a >= 3600000 ? `${Math.floor(a / 3600000)} h ${Math.floor((a % 3600000) / 60000)} m` : `${Math.max(1, Math.floor(a / 60000))} m`;
    const cls = ms < 0 ? 'p-bad' : ms < 3 * 3600000 ? 'p-bad' : ms < 86400000 ? 'p-warn' : 'p-dim';
    return `<span class="pill ${cls}">${ms < 0 ? `${t} late` : `${t} left`}</span>`;
  }
  const pill = (s) => { const [t, c] = STATUS[s] || [s, 'p-dim']; return `<span class="pill ${c}">${t}</span>`; };
  const link = (u) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//, '').slice(0, 48))}</a>` : '');

  VIEWS.legal = async () => {
    const view = C.st.legalView || 'open';
    const d = await api('/legal?status=' + view); const s = d.summary || {}; C.st.legal = d;
    const owner = me().role === 'owner';
    const complaints = d.complaints.map((g) => `<tr>
      <td><b>#${g.ticket}</b>${g.urgent ? ' <span class="pill p-bad">2-hour</span>' : ''}<div class="small mu">${dtt(g.createdAt)}</div></td>
      <td><b>${esc(g.name)}</b><div class="small mu">${esc(g.email)}</div></td>
      <td>${esc(g.categoryText)}<div class="small">${link(g.aboutUrl)}${g.aboutUsername ? ` @${esc(g.aboutUsername)}` : ''}</div><div class="small mu" style="max-width:420px;white-space:pre-wrap">${esc(g.details.slice(0, 280))}${g.details.length > 280 ? '…' : ''}</div></td>
      <td>${['resolved', 'rejected'].includes(g.status) ? `<div class="small mu">${dtt(g.resolvedAt)}</div>` : left(g.dueAt)}</td>
      <td>${pill(g.status)}${g.handledBy ? `<div class="small mu">${esc(g.handledBy)}</div>` : ''}</td>
      <td>${['resolved', 'rejected'].includes(g.status) ? '' : `<button class="btn sm pri" data-g="${g.id}">Decide</button>`}</td></tr>`).join('');
    const orders = d.orders.map((o) => `<tr>
      <td><b>L${o.ref}</b><div class="small mu">${dtt(o.receivedAt)}</div></td>
      <td><b>${esc(o.authority)}</b><div class="small mu">${esc(SRC[o.source] || o.source)}${o.orderRef ? ` · ${esc(o.orderRef)}` : ''}</div></td>
      <td>${esc(KIND[o.kind])}<div class="small mu" style="max-width:420px;white-space:pre-wrap">${esc(o.summary.slice(0, 220))}</div>${o.contentUrls.map((u) => `<div class="small">${link(u)}</div>`).join('')}${o.targetUsername ? `<div class="small">@${esc(o.targetUsername)}</div>` : ''}</td>
      <td>${o.status === 'open' ? left(o.dueAt) : `<div class="small mu">${dtt(o.doneAt)}</div>`}</td>
      <td>${pill(o.status)}${o.removedCount ? `<div class="small mu">${o.removedCount} removed</div>` : ''}${o.doneBy ? `<div class="small mu">${esc(o.doneBy)}</div>` : ''}</td>
      <td>${o.status === 'open' ? `<button class="btn sm pri" data-o="${o.id}">Act</button>` : ''}</td></tr>`).join('');
    const bans = d.bans.map((b) => `<tr><td><b>@${esc(b.username || '—')}</b><div class="small mu">${esc(b.name || '')}</div></td><td class="small" style="max-width:420px">${esc(b.reason)}</td><td class="small mu">${dtt(b.bannedAt)}</td><td class="small mu">${new Date(b.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${b.face ? '<span class="pill p-acc">Face kept</span>' : ''}</td><td>${owner ? `<button class="btn sm" data-lift="${b.id}" data-u="${esc(b.username || '')}">Lift</button>` : ''}</td></tr>`).join('');
    return `<div class="grid k4">${kpi('Open complaints', fmt(s.open_complaints), N(s.urgent_complaints) ? `${fmt(s.urgent_complaints)} urgent (2-hour)` : 'reply within 7 days', N(s.late_complaints) || N(s.urgent_complaints) ? 'dn' : 'up')}${kpi('Late complaints', fmt(s.late_complaints), 'past their deadline', N(s.late_complaints) ? 'dn' : 'up')}${kpi('Open legal orders', fmt(s.open_orders), N(s.late_orders) ? `${fmt(s.late_orders)} late` : 'remove within 3 hours', N(s.open_orders) ? 'dn' : 'up')}${kpi('Active bans', fmt(s.active_bans), 'face, phone and email blocked')}</div>
<div class="panel mt"><div class="row-actions" style="justify-content:flex-start;margin:0">${['open', 'closed', 'all'].map((k) => `<button class="btn sm ${view === k ? 'pri' : ''}" data-view="${k}">${{ open: 'Open', closed: 'Closed', all: 'All' }[k]}</button>`).join('')}</div></div>
<div class="panel mt"><h3>Complaints to the Grievance Officer<span class="r">acknowledged by email at once · decide in 7 days · intimate / impersonation in 2 hours</span></h3>
<div class="tw"><table><tr><th>Ticket</th><th>From</th><th>About</th><th>Deadline</th><th>Status</th><th></th></tr>${complaints || '<tr><td colspan="6" class="empty">No complaints here.</td></tr>'}</table></div>
<p class="small mu">People file these in the app (Settings › Grievance Officer › Raise a complaint). Complaints that arrive by email: ask the person to use the form, or file it for them there so the clock and records are kept.</p></div>
<div class="panel mt"><h3>Police, court and government orders<span class="r"><button class="btn sm pri" id="addOrder">+ Log an order</button></span></h3>
<div class="tw"><table><tr><th>Ref</th><th>From</th><th>What they want</th><th>Deadline</th><th>Status</th><th></th></tr>${orders || '<tr><td colspan="6" class="empty">No orders here.</td></tr>'}</table></div>
<p class="small mu">Check every order is genuine before acting: official email domain, a signed order, or call the office back on a number you find yourself. Share only what the order names. Takedowns: 3 hours. User information: 72 hours.</p></div>
<div class="panel mt"><h3>Bans<span class="r">${owner ? '<button class="btn sm" id="addBan">Ban an account</button>' : 'only the owner can ban or lift'}</span></h3>
<div class="tw"><table><tr><th>Account</th><th>Reason</th><th>Banned</th><th>Until</th><th></th><th></th></tr>${bans || '<tr><td colspan="6" class="empty">No active bans.</td></tr>'}</table></div>
<p class="small mu">A ban erases the account at once and keeps the name, phone, email and an encrypted face fingerprint (3 years by default) so the person can't sign up again. The person is emailed the reason and how to appeal. Lifting a ban erases the face fingerprint.</p></div>`;
  };

  AFTER.legal = () => {
    const d = C.st.legal;
    document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => { C.st.legalView = b.dataset.view; render(); }; });
    document.querySelectorAll('[data-g]').forEach((b) => {
      const g = d.complaints.find((x) => String(x.id) === b.dataset.g);
      b.onclick = () => C.modal(`Complaint #${g.ticket}`, `<div class="note small" style="white-space:pre-wrap">${esc(g.details)}</div>
<div class="form"><label>Decision<select id="m1"><option value="resolved">Resolved: action taken</option><option value="rejected">No action (explain why)</option><option value="in_progress">Still working on it</option></select></label>
${g.aboutUrl && /\/(spark|post)\//.test(g.aboutUrl) ? '<label class="full"><span><input type="checkbox" id="m3"> Remove the linked Spark / post (the person who posted it is emailed)</span></label>' : ''}
<label class="full">Reply to ${esc(g.name)} (emailed when resolved or no action)<textarea id="m2" rows="5" maxlength="2000" placeholder="What we did and why. Mention the Grievance Appellate Committee is open to them if they disagree (added automatically)."></textarea></label></div>`,
      async () => { const r = await api('/legal/complaints/' + g.id, { method: 'PATCH', body: { status: $('#m1').value, resolution: $('#m2').value || undefined, removeContent: !!$('#m3')?.checked } }); toast(r.removed ? 'Saved · content removed' : 'Saved'); render(); }, 'Save decision');
    });
    document.querySelectorAll('[data-o]').forEach((b) => {
      const o = d.orders.find((x) => String(x.id) === b.dataset.o);
      b.onclick = () => C.modal(`Order L${o.ref} · ${o.authority}`, `<div class="note small" style="white-space:pre-wrap">${esc(o.summary)}</div>
<div class="form"><label>Action<select id="m1">${o.contentUrls.length ? '<option value="remove">Remove the linked content now</option>' : ''}<option value="done">Done (information shared / records preserved / handled)</option><option value="reject">Refuse (not genuine or not valid)</option></select></label>
<label class="full">What was done (kept as evidence)<textarea id="m2" rows="4" maxlength="2000" placeholder="e.g. Shared username, phone and join date for @x with SI Rao, Cyber Crime PS, by email on 17 Nov."></textarea></label></div>`,
      async () => { const r = await api('/legal/orders/' + o.id, { method: 'POST', body: { action: $('#m1').value, note: $('#m2').value || undefined } }); toast(r.removed ? `${r.removed} removed` : 'Saved'); render(); }, 'Save');
    });
    const add = $('#addOrder'); if (add) add.onclick = () => C.modal('Log a legal order', `<div class="form">
<label>From<select id="o1">${Object.entries(SRC).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
<label>What they want<select id="o2">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
<label class="full">Authority (court, ministry, police station)<input id="o3" required maxlength="200"></label>
<label>Their reference / case no.<input id="o4" maxlength="120"></label><label>Order date<input id="o5" type="date"></label>
<label>Received at<input id="o6" type="datetime-local"></label><label>Account (@username)<input id="o7" maxlength="41"></label>
<label class="full">Links to the Sparks / posts (one per line)<textarea id="o8" rows="3"></textarea></label>
<label class="full">Summary of the order<textarea id="o9" rows="3" required maxlength="2000"></textarea></label>
<label class="full"><span><input type="checkbox" id="o10"> I checked this order is genuine (official email domain, signed order, or called the office back)</span></label></div>`,
    async () => {
      const v = (id) => $(id).value.trim() || undefined; const rec = $('#o6').value;
      await api('/legal/orders', { method: 'POST', body: { source: v('#o1'), kind: v('#o2'), authority: v('#o3'), orderRef: v('#o4'), orderDate: v('#o5'), receivedAt: rec ? new Date(rec).toISOString() : undefined, targetUsername: v('#o7'), contentUrls: ($('#o8').value || '').split('\n').map((x) => x.trim()).filter(Boolean), summary: v('#o9'), verified: $('#o10').checked } });
      toast('Order logged · the deadline clock has started'); render();
    }, 'Log order');
    const ban = $('#addBan'); if (ban) ban.onclick = () => C.modal('Ban an account', `<p class="small">This <b>erases the account now</b> and can't be undone. Use it for serious or repeated violations (harassment, sexual content without consent, impersonation, fraud, threats).</p><div class="form">
<label>Username<input id="b1" required maxlength="41" placeholder="@username"></label><label>How long<select id="b2"><option value="">3 years (default)</option><option value="365">1 year</option><option value="180">6 months</option></select></label>
<label class="full">Reason (emailed to the person, so keep it factual)<textarea id="b3" rows="3" required minlength="10" maxlength="500"></textarea></label>
<label class="full"><span><input type="checkbox" id="b4" required> I understand the account and its content are erased now</span></label></div>`,
    async () => { await api('/legal/bans', { method: 'POST', body: { username: $('#b1').value.trim(), days: $('#b2').value ? Number($('#b2').value) : undefined, reason: $('#b3').value.trim(), confirm: $('#b4').checked } }); toast('Account banned'); render(); }, 'Ban and erase');
    document.querySelectorAll('[data-lift]').forEach((b) => { b.onclick = () => C.modal(`Lift the ban on @${b.dataset.u}?`, '<p class="small">They will be able to sign up again. Their face fingerprint is erased.</p><div class="form"><label class="full">Why (e.g. appeal accepted)<textarea id="l1" rows="3" required minlength="10" maxlength="500"></textarea></label></div>',
      async () => { await api(`/legal/bans/${b.dataset.lift}/lift`, { method: 'POST', body: { reason: $('#l1').value.trim() } }); toast('Ban lifted'); render(); }, 'Lift ban'); });
  };
})();
