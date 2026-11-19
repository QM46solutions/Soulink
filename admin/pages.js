// Console pages: overview, users, activity, growth, speed, issues, releases, revenue, safety, team.
(function () {
  const { line, columns, bars, donut, spark, heat, fmt, esc } = window.Charts;
  const C = window.__console; const { api, VIEWS, AFTER, st, kpi, rs, N, pct, dt, dtt, ago, toast, render, canEdit, $ } = C;
  const day = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const PLAT = { android: ['Android', 'var(--good)'], ios: ['iPhone', 'var(--accent)'], web: ['Web / unknown', 'var(--dim)'] };
  const collecting = (what) => `<div class="note">${what} starts filling in from today, because the server only began recording it with this console.</div>`;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);

  VIEWS.overview = async () => {
    const d = await api('/overview'); const t = d.totals || {}; const c = d.counts || {}; const total = N(t.total);
    const g = d.growth || []; const dau = d.dau || []; const P = d.platforms || {};
    const and = N(P.android); const ios = N(P.ios); const web = N(P.web);
    const m = d.server?.latest; const wk = d.server?.week || {};
    const errRate = N(wk.req) ? ((N(wk.err) / N(wk.req)) * 100).toFixed(2) : null;
    const copyrightAge = c.copyrightOldest ? Math.round((Date.now() - new Date(c.copyrightOldest)) / 3600000) : null;
    const alerts = [];
    if (N(c.copyrightOpen)) alerts.push(['bad', `<b>${N(c.copyrightOpen)} copyright notice${N(c.copyrightOpen) > 1 ? 's' : ''}</b> waiting${copyrightAge != null ? ` · oldest ${copyrightAge} h (36-hour rule)` : ''}`, 'safety']);
    if (N(c.issuesUrgent)) alerts.push(['bad', `<b>${N(c.issuesUrgent)} high-priority issue${N(c.issuesUrgent) > 1 ? 's' : ''}</b> open`, 'issues']);
    if (N(c.reportsOpen)) alerts.push(['warn', `<b>${N(c.reportsOpen)} user report${N(c.reportsOpen) > 1 ? 's' : ''}</b> to review`, 'safety']);
    if (N(c.adDue) > 0) alerts.push(['warn', `<b>${rs(c.adDue)}</b> still to be paid by ad customers`, 'ads']);
    if (m && N(m.p95_ms) > 1500) alerts.push(['warn', `Server is slow: slowest 5% of requests take <b>${(N(m.p95_ms) / 1000).toFixed(1)} s</b>`, 'performance']);
    if (!alerts.length) alerts.push(['good', '<b>Nothing needs attention right now.</b>', null]);
    const rel = d.release; let relF = []; try { relF = JSON.parse(rel?.features || '[]'); } catch { relF = []; }
    const dauOf = (dayStr) => (dau.find((y) => y.day === dayStr) || {}).users || 0;
    return `
<div class="grid k4">
 ${kpi('Total users', fmt(total), `▲ ${fmt(t.new30)} in 30 days · ${fmt(t.new1)} today`, 'up', spark(g.map((x) => x.users)))}
 ${kpi('Active today', fmt(t.today), `${pct(N(t.today), total)}% of users · ${fmt(t.week)} this week`, 'mu', spark(dau.map((x) => x.users), 'var(--accent2)'))}
 ${kpi('Android · iPhone', `${fmt(and)} · ${fmt(ios)}`, `${pct(and, and + ios + web)}% Android${web ? ` · ${fmt(web)} web/unknown` : ''}`)}
 ${kpi('Ad money this month', rs(c.adPaidMonth), `${N(c.adsLive)} ad${N(c.adsLive) === 1 ? '' : 's'} live now`, 'up')}
</div>
<div class="grid k5 mt">
 ${kpi('Face-verified', fmt(t.verified), `${pct(N(t.verified), total)}% of users`)}
 ${kpi('Soul DNA done', fmt(t.soul), `${pct(N(t.soul), total)}% of users`)}
 ${kpi('Connections', fmt(c.connections), 'people linked both ways')}
 ${kpi('Last 24 hours', `${fmt(c.posts24)} · ${fmt(c.sparks24)}`, 'posts · Sparks')}
 ${kpi('Messages, 24 h', fmt(c.messages24), 'sent in chats')}
</div>
<div class="grid c21 mt">
 <div class="panel"><h3>Users and daily active users<span class="r">last 30 days</span></h3>
  <div class="legend"><span><i style="background:var(--accent)"></i>Total users</span><span><i style="background:var(--accent2)"></i>Active that day</span></div>
  ${line(dau.length >= 2 ? [g.map((x) => x.users), g.map((x) => dauOf(x.day))] : [g.map((x) => x.users)], { labels: g.length === 30 ? [[0, day(g[0].day)], [14, day(g[14].day)], [29, day(g[29].day)]] : [] })}
  ${dau.length < 2 ? '<div class="small mu">Daily active users start recording from today.</div>' : ''}</div>
 <div class="panel"><h3>Needs attention</h3>${alerts.map(([k, html, to]) => `<div class="alert"><span class="dot" style="background:var(--${k})"></span><div>${html}${to ? `<div class="small"><a href="#${to}">Open</a></div>` : ''}</div></div>`).join('')}</div>
</div>
<div class="grid k3 mt">
 <div class="panel"><h3>New sign-ups per day<span class="r">30 days</span></h3>${columns(g.map((x) => ({ label: day(x.day), value: x.signups })), { h: 160, every: 7, col: 'var(--accent2)' })}</div>
 <div class="panel"><h3>Phones</h3><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">${donut([['Android', and, 'var(--good)'], ['iPhone', ios, 'var(--accent)'], ['Web / unknown', web, 'var(--dim)']])}
  <div class="legend" style="flex-direction:column;gap:6px"><span><i style="background:var(--good)"></i>Android ${fmt(and)}</span><span><i style="background:var(--accent)"></i>iPhone ${fmt(ios)}</span><span><i style="background:var(--dim)"></i>Web / unknown ${fmt(web)}</span></div></div></div>
 <div class="panel"><h3>Server health</h3>
  <div class="price"><span>Status</span><b class="${m ? 'up' : 'mu'}">${m ? 'Running' : 'Collecting'}</b></div>
  <div class="price"><span>Typical response</span><b>${m ? `${N(m.p50_ms)} ms` : '—'}</b></div>
  <div class="price"><span>Slowest 5%</span><b>${m ? `${N(m.p95_ms)} ms` : '—'}</b></div>
  <div class="price"><span>Errors this week</span><b>${errRate != null ? errRate + '%' : '—'}</b></div>
  <div class="price"><span>Up since restart</span><b>${d.server?.uptimeHours ?? '—'} h</b></div></div>
</div>
<div class="grid k3 mt">
 <div class="panel"><h3>Busiest hour</h3>${d.peakHour ? `<div class="kpi"><div class="v">${d.peakHour.hour}:00 – ${d.peakHour.hour + 1}:00</div><div class="d mu">about ${fmt(d.peakHour.users)} people in that hour, last 2 weeks</div></div>` : collecting('The busiest hour')}</div>
 <div class="panel"><h3>Issues</h3><div class="kpi"><div class="v">${fmt(c.issuesOpen)}</div><div class="d ${N(c.issuesUrgent) ? 'dn' : 'mu'}">open · ${fmt(c.issuesUrgent)} high priority</div></div><div class="small mt"><a href="#issues">See all issues</a></div></div>
 <div class="panel"><h3>Latest release</h3>${rel ? `<div style="font-family:var(--display);font-weight:700;font-size:18px">${esc(rel.version)}</div><div class="small mu">${esc(rel.track || rel.channel)} · ${dt(rel.released_on)} · ${esc(rel.status)}</div><div class="small mt">${esc(relF[0] || '')}</div><div class="small mt"><a href="#releases">Release history</a></div>` : '<div class="empty">No releases yet</div>'}</div>
</div>`;
  };

  VIEWS.users = async () => {
    const q = new URLSearchParams(); ['city', 'gender', 'age', 'platform'].forEach((k) => st[k] && q.set(k, st[k]));
    const d = await api('/users' + (q.toString() ? '?' + q : ''));
    const sel = (id, label, opts, cur) => `<label for="${id}">${label}<select id="${id}"><option value="">All</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const and = (d.platform.find((x) => x.key === 'android') || {}).n || 0; const ios = (d.platform.find((x) => x.key === 'ios') || {}).n || 0;
    const GC = ['var(--accent)', 'var(--accent2)', 'var(--dim)', 'var(--accent3)'];
    return `<div class="filters">
 ${sel('fCity', 'City', d.cities.map((c) => [c, c]), st.city)}
 ${sel('fG', 'Gender', [['Men', 'Men'], ['Women', 'Women'], ['Other / not said', 'Other / not said']], st.gender)}
 ${sel('fA', 'Age group', ['18–21', '22–25', '26–30', '31–35', '36+', 'Not said'].map((a) => [a, a]), st.age)}
 ${sel('fP', 'Phone', [['android', 'Android'], ['ios', 'iPhone'], ['web', 'Web / unknown']], st.platform)}
 <button class="btn" id="csv">Download counts (CSV)</button>${canEdit() ? ' <button class="btn" id="setEmail">Set sign-in email</button>' : ''}</div>
<div class="grid k4">${kpi('Users matching', fmt(d.total), 'accounts that finished sign-up')}${kpi('Android', fmt(and), pct(and, d.total) + '%')}${kpi('iPhone', fmt(ios), pct(ios, d.total) + '%')}${kpi('Active in last 7 days', fmt(d.active7), pct(d.active7, d.total) + '% of these users', 'up')}</div>
<div class="grid k3 mt">
 <div class="panel"><h3>Gender</h3><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">${donut(d.gender.map((x, i) => [x.key, x.n, GC[i % 4]]))}<div class="legend" style="flex-direction:column;gap:6px">${d.gender.map((x, i) => `<span><i style="background:${GC[i % 4]}"></i>${esc(x.key)} ${pct(x.n, d.total)}%</span>`).join('')}</div></div></div>
 <div class="panel"><h3>Age groups</h3>${bars(d.age.map((x) => [x.key, x.n]))}</div>
 <div class="panel"><h3>Phones</h3>${bars(d.platform.map((x) => [PLAT[x.key]?.[0] || x.key, x.n, PLAT[x.key]?.[1]]))}</div>
</div>
<div class="grid k2 mt"><div class="panel"><h3>By city</h3>${bars(d.city.map((x) => [x.key, x.n]))}</div>
 <div class="panel"><h3>By area</h3><div class="note">Soulink stores each person's <b>city</b> today. Area (Gachibowli, Kondapur…) needs a new "area" field in the profile, which comes with the next app version.</div></div></div>
<p class="small mu mt">Groups smaller than 10 people are merged into "Smaller groups" so nobody can be singled out.</p>`;
  };
  AFTER.users = () => {
    [['fCity', 'city'], ['fG', 'gender'], ['fA', 'age'], ['fP', 'platform']].forEach(([id, k]) => { $('#' + id).onchange = (e) => { st[k] = e.target.value || null; render(); }; });
    const se = $('#setEmail'); if (se) se.onclick = () => modal('Set a sign-in email', `<p class="small">For someone who can't sign in, e.g. an account made with a phone number while text-message codes are off. Only do this when the person asked you directly. The address gets a notice, and it counts as verified only after they sign in with a code sent to it.</p><div class="form">
<label>Their phone number<input id="se1" required maxlength="20" placeholder="98xxxxxxxx"></label><label>Email to sign in with<input id="se2" type="email" required maxlength="254"></label>
<label class="full">Why (kept in the audit log)<textarea id="se3" rows="2" required minlength="10" maxlength="300" placeholder="e.g. Asked on WhatsApp on 19 Nov; phone-only account, can't sign in while SMS is off."></textarea></label>
<label class="full"><span><input type="checkbox" id="se4" required> The person asked for this and the email is theirs</span></label></div>`,
      async () => { const r = await api('/users/set-email', { method: 'POST', body: { phone: $('#se1').value.trim(), email: $('#se2').value.trim(), reason: $('#se3').value.trim(), confirm: $('#se4').checked } }); toast(r.unchanged ? 'That email was already set' : `Sign-in email set${r.username ? ' for @' + r.username : ''}`); }, 'Set email');
    $('#csv').onclick = () => {
      const rows = [['Group', 'Value', 'Users']];
      document.querySelectorAll('#view .panel').forEach((p) => { const h = p.querySelector('h3')?.textContent; p.querySelectorAll('.bars .row').forEach((r) => rows.push([h, r.children[0].textContent, r.children[2].textContent.replace(/,/g, '')])); });
      download('soulink-users.csv', rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
  };

  VIEWS.activity = async () => {
    const d = await api('/activity');
    const peak = d.cells.reduce((a, c) => (c.users > (a?.users || 0) ? c : a), null);
    const byHour = Array.from({ length: 24 }, (_, h) => d.cells.filter((c) => c.hour === h).reduce((s, c) => s + c.users, 0) / 7);
    const today = Array.from({ length: 24 }, (_, h) => (d.today.find((x) => x.hour === h) || {}).users || 0);
    const wdN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const byDay = wdN.map((_, i) => d.cells.filter((c) => c.wd === i).reduce((s, c) => s + c.users, 0));
    const bestDay = byDay.indexOf(Math.max(...byDay));
    const hourNow = new Date(Date.now() + 330 * 60000).getUTCHours();
    return `<div class="grid k4">${kpi('Busiest hour', peak ? `${peak.hour}:00` : '—', peak ? `${wdN[peak.wd]} · about ${fmt(Math.round(peak.users))} people` : 'collecting')}${kpi('Busiest day', d.cells.length ? wdN[bestDay] : '—', 'average over 4 weeks')}${kpi('People this hour', fmt(today[hourNow]), 'different people so far')}${kpi('Days recorded', fmt(d.daysRecorded), 'grows every day')}</div>
${d.cells.length ? '' : `<div class="mt">${collecting('This page')}</div>`}
<div class="panel mt"><h3>People online, hour by day<span class="r">Indian time · last 4 weeks · hover a cell</span></h3>${heat(d.cells)}
 <div class="legend mt"><span>Fewer</span><span style="flex:0 0 140px;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--panel2),var(--accent))"></span><span>More</span></div></div>
<div class="grid k2 mt"><div class="panel"><h3>Today, hour by hour</h3>${columns(today.map((v, h) => ({ label: String(h), value: v })), { h: 170, every: 3, col: 'var(--accent2)' })}</div>
 <div class="panel"><h3>Average day<span class="r">last 4 weeks</span></h3>${columns(byHour.map((v, h) => ({ label: String(h), value: Math.round(v) })), { h: 170, every: 3 })}<div class="small mu">Use the busiest hours to price ads higher on the rate card.</div></div></div>`;
  };

  VIEWS.growth = async () => {
    const f = (await api('/growth')).funnel || {};
    const steps = [['Started sign-up', f.joined], ['Finished profile', f.profile], ['Passed face check', f.face], ['Finished Soul DNA', f.soul], ['Sent a Connect request', f.requested], ['Has a connection', f.connected], ['Came back after a week', f.week2]].map(([l, v]) => [l, N(v)]);
    const top = Math.max(1, steps[0][1]); let worst = null;
    for (let i = 1; i < steps.length; i++) { const drop = steps[i - 1][1] - steps[i][1]; if (!worst || drop > worst.drop) worst = { from: steps[i - 1][0], to: steps[i][0], drop, p: pct(drop, steps[i - 1][1]) }; }
    return `<div class="panel"><h3>New-user journey<span class="r">people who started sign-up in the last 90 days</span></h3>
${bars(steps.map(([l, v], i) => [l, v, i >= 4 ? 'var(--accent2)' : 'var(--accent)', `${fmt(v)} · ${pct(v, top)}%`]), { max: top })}</div>
<div class="grid k3 mt">${kpi('Biggest drop', worst ? `${worst.p}%` : '—', worst ? `${esc(worst.from)} → ${esc(worst.to)}` : '', 'dn')}${kpi('Face check pass rate', pct(steps[2][1], steps[1][1]) + '%', 'of people who finished their profile')}${kpi('Came back after a week', pct(steps[6][1], top) + '%', 'of everyone who started', 'up')}</div>`;
  };

  VIEWS.performance = async () => {
    const d = await api('/performance'); const s = d.series || []; const rec = d.recent || []; const m = d.server?.latest;
    const last = rec.slice(-72);
    return `<div class="grid k4">${kpi('Typical response', m ? `${N(m.p50_ms)} ms` : '—', m ? `slowest 5%: ${N(m.p95_ms)} ms` : 'collecting')}${kpi('Requests, last 5 min', m ? fmt(m.requests) : '—', m ? `${N(m.errors)} errors` : '')}${kpi('Server load (CPU)', m ? `${N(m.cpu_pct)}%` : '—', `memory ${d.server?.rssMb ?? '—'} MB`)}${kpi('Database size', d.dbMb != null ? `${fmt(d.dbMb)} MB` : '—', 'Azure SQL Basic allows 2,048 MB', d.dbMb > 1600 ? 'wa' : 'mu')}</div>
${rec.length ? '' : `<div class="mt">${collecting('Server health')}</div>`}
<div class="grid k2 mt">
 <div class="panel"><h3>Response time, last 6 hours<span class="r">ms</span></h3><div class="legend"><span><i style="background:var(--accent)"></i>Typical</span><span><i style="background:var(--accent2)"></i>Slowest 5%</span></div>${last.length >= 2 ? line([last.map((x) => N(x.p50_ms)), last.map((x) => N(x.p95_ms))], { h: 170, zero: true, fill: false }) : '<div class="empty">Collecting</div>'}</div>
 <div class="panel"><h3>Server load, last 6 hours<span class="r">CPU %</span></h3>${last.length >= 2 ? line([last.map((x) => N(x.cpu_pct))], { h: 170, zero: true, cols: ['var(--accent3)'] }) : '<div class="empty">Collecting</div>'}</div>
</div>
<div class="grid k2 mt">
 <div class="panel"><h3>Requests per day<span class="r">14 days</span></h3>${columns(s.map((x) => ({ label: day(iso(x.day)), value: N(x.req) })), { h: 160, every: 2 })}</div>
 <div class="panel"><h3>Slowest server calls<span class="r">last 24 h</span></h3>${d.slowCalls.length ? `<div class="tw"><table><tr><th>Call</th><th class="n">Slowest avg</th><th class="n">Times</th></tr>${d.slowCalls.map((x) => `<tr><td class="small">${esc(x.call)}</td><td class="n">${x.ms} ms</td><td class="n">${fmt(x.n)}</td></tr>`).join('')}</table></div>` : '<div class="empty">Collecting</div>'}</div>
</div>
<div class="panel mt"><h3>Slowest screens in the app<span class="r">time until the screen is usable · last 7 days · target 1.5 s</span></h3>
${d.screens.length ? `<div class="tw"><table><tr><th>Screen</th><th>Phone</th><th class="n">Average</th><th class="n">Slowest</th><th class="n">Times opened</th><th></th></tr>${d.screens.map((x) => `<tr><td><b>${esc(x.screen)}</b></td><td>${esc(PLAT[x.platform]?.[0] || x.platform || '—')}</td><td class="n">${(N(x.avg_ms) / 1000).toFixed(2)} s</td><td class="n">${(N(x.max_ms) / 1000).toFixed(1)} s</td><td class="n">${fmt(x.n)}</td><td>${N(x.avg_ms) > 1500 ? '<span class="pill p-warn">Over target</span>' : '<span class="pill p-good">OK</span>'}</td></tr>`).join('')}</table></div>`
  : '<div class="note">Screen timings come from the app itself. They start arriving once phones have the next app version, which measures every screen and sends the numbers here.</div>'}</div>`;
  };

  const SEV = { critical: 'p-bad', high: 'p-bad', medium: 'p-warn', low: 'p-dim' };
  const STS = { new: ['New', 'p-acc'], progress: ['In progress', 'p-warn'], fixed: ['Fixed · waiting release', 'p-good'], released: ['Fixed · released', 'p-good'], wontfix: ["Won't fix", 'p-dim'] };
  const SRC = { user: 'User report', crash: 'Crash', team: 'Team' };
  VIEWS.issues = async () => {
    const d = await api('/issues'); const f = st.issueF || 'open'; const s = d.summary || {};
    const list = d.issues.filter((x) => f === 'all' || (f === 'open' ? ['new', 'progress'].includes(x.status) : ['fixed', 'released'].includes(x.status)));
    const edit = canEdit('support');
    return `<div class="grid k4">${kpi('Reported, all time', fmt(s.total), 'users, crashes and team')}${kpi('Open now', fmt(s.open_), 'new + in progress', N(s.open_) ? 'wa' : 'up')}${kpi('Fixed, waiting release', fmt(s.waiting), 'goes out with the next update')}${kpi('Fixed, last 30 days', fmt(s.fixed30), '', 'up')}</div>
<div class="panel mt"><h3><span class="tabs" style="border:0;margin:0">${[['open', 'Open'], ['fixed', 'Fixed'], ['all', 'All']].map(([k, t]) => `<button class="${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</span><span class="r">${edit ? '<button class="btn sm pri" id="addIssue">+ Add issue</button>' : ''}</span></h3>
<div class="tw"><table><tr><th>ID</th><th>Problem</th><th>From</th><th class="n">Reports</th><th>Priority</th><th>Status</th><th>Owner</th><th>Updated</th></tr>
${list.map((x) => `<tr><td class="n" style="text-align:left">SL-${x.id}</td><td><b>${esc(x.title)}</b>${x.app_version ? `<div class="small mu">${esc(x.platform || '')} · app ${esc(x.app_version)}</div>` : ''}</td><td class="mu">${SRC[x.source]}</td><td class="n">${x.reports}</td>
 <td>${edit ? `<select data-sev="${x.id}" aria-label="Priority">${['critical', 'high', 'medium', 'low'].map((v) => `<option ${v === x.severity ? 'selected' : ''}>${v}</option>`).join('')}</select>` : `<span class="pill ${SEV[x.severity]}">${x.severity}</span>`}</td>
 <td>${edit ? `<select data-st="${x.id}" aria-label="Status">${Object.entries(STS).map(([k, [tt]]) => `<option value="${k}" ${k === x.status ? 'selected' : ''}>${tt}</option>`).join('')}</select>` : `<span class="pill ${STS[x.status][1]}">${STS[x.status][0]}</span>`}</td>
 <td>${esc(x.owner || '—')}</td><td class="mu small">${ago(x.updated_at)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nothing here.</td></tr>'}
</table></div><p class="small mu">From the next app version, users can send problems from Settings › Report a problem, and crashes are sent automatically. They appear here.</p></div>`;
  };
  AFTER.issues = () => {
    document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { st.issueF = b.dataset.f; render(); }; });
    document.querySelectorAll('[data-st]').forEach((s) => { s.onchange = async () => { await api('/issues/' + s.dataset.st, { method: 'PATCH', body: { status: s.value } }); toast('Status updated'); }; });
    document.querySelectorAll('[data-sev]').forEach((s) => { s.onchange = async () => { await api('/issues/' + s.dataset.sev, { method: 'PATCH', body: { severity: s.value } }); toast('Priority updated'); }; });
    const add = $('#addIssue'); if (add) add.onclick = () => modal('Add an issue', `<div class="form"><label class="full">Problem<input id="m1" maxlength="200" required></label><label class="full">Details<textarea id="m2" rows="4" maxlength="2000"></textarea></label><label>Priority<select id="m3"><option>high</option><option selected>medium</option><option>low</option><option>critical</option></select></label></div>`,
      async () => { await api('/issues', { method: 'POST', body: { title: $('#m1').value, details: $('#m2').value, severity: $('#m3').value } }); toast('Issue added'); render(); });
  };

  const CH = { play: 'Play Store', appstore: 'App Store', ota: 'Over-the-air', apk: 'Test APK' };
  VIEWS.releases = async () => {
    const r = (await api('/releases')).releases; const latest = (ch) => r.find((x) => x.channel === ch);
    const play = latest('play'); const apple = latest('appstore'); const ota = latest('ota');
    return `<div class="grid k3">${kpi('Play Store', play ? esc(play.version) : '—', play ? `${esc(play.track || '')} · ${esc(play.status)}` : '')}${kpi('App Store', apple ? esc(apple.version) : '—', apple ? esc(apple.status) : 'Apple account not set up yet', apple ? 'mu' : 'wa')}${kpi('Newest over-the-air update', ota ? dt(ota.released_on) : '—', ota ? esc(ota.version) : '')}</div>
<div class="panel mt"><h3>Release history<span class="r">${canEdit() ? '<button class="btn sm pri" id="addRel">+ Add release</button>' : ''}</span></h3><div class="tl">
${r.map((x) => `<div class="rel"><div class="meta"><span class="ver">${esc(x.version)}</span><span class="pill ${/live/i.test(x.status) ? 'p-good' : /progress|review/i.test(x.status) ? 'p-warn' : 'p-dim'}">${esc(x.status)}</span><span class="small mu">${CH[x.channel]}${x.track ? ' · ' + esc(x.track) : ''} · ${dt(x.released_on)}</span>${canEdit() ? `<button class="btn sm" data-rs="${x.id}">Change status</button>` : ''}</div>
 <ul>${x.features.map((f) => `<li><b style="color:var(--fg)">New:</b> ${esc(f)}</li>`).join('')}${x.fixes.map((f) => `<li><b style="color:var(--fg)">Fixed:</b> ${esc(f)}</li>`).join('')}</ul></div>`).join('') || '<div class="empty">No releases yet</div>'}
</div><p class="small mu">Store versions need Google or Apple review. Over-the-air updates change screens and logic straight away, with no review. Icon, permissions and native changes still need a store version.</p></div>`;
  };
  AFTER.releases = () => {
    const a = $('#addRel'); if (a) a.onclick = () => modal('Add a release', `<div class="form"><label>Version<input id="m1" placeholder="1.0.0 (4)" required></label><label>Where<select id="m2"><option value="play">Play Store</option><option value="appstore">App Store</option><option value="ota">Over-the-air</option><option value="apk">Test APK</option></select></label>
      <label>Track<input id="m3" placeholder="Production / Internal testing"></label><label>Status<input id="m4" value="In review" required></label><label>Date<input id="m5" type="date" value="${C.todayIST()}" required></label><span></span>
      <label class="full">New features (one per line)<textarea id="m6" rows="4"></textarea></label><label class="full">Fixes (one per line)<textarea id="m7" rows="3"></textarea></label></div>`,
      async () => { const lines = (id) => $(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
        await api('/releases', { method: 'POST', body: { version: $('#m1').value, channel: $('#m2').value, track: $('#m3').value, status: $('#m4').value, releasedOn: $('#m5').value, features: lines('#m6'), fixes: lines('#m7') } }); toast('Release added'); render(); });
    document.querySelectorAll('[data-rs]').forEach((b) => { b.onclick = () => modal('Change status', `<label class="small mu">Status<input id="m1" value="Live" required></label>`, async () => { await api('/releases/' + b.dataset.rs, { method: 'PATCH', body: { status: $('#m1').value } }); toast('Updated'); render(); }); });
  };

  VIEWS.revenue = async () => {
    const d = await api('/revenue');
    const months = []; const now = new Date(Date.now() + 330 * 60000);
    for (let i = 5; i >= 0; i--) { const x = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); months.push(x.toISOString().slice(0, 7)); }
    const val = (arr, m) => N((arr.find((x) => x.m === m) || {}).v);
    const items = months.map((m) => ({ label: new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' }), stack: [{ value: val(d.ads, m), color: 'var(--accent)' }, { value: val(d.paidMessages, m), color: 'var(--accent2)' }, { value: val(d.boosts, m), color: 'var(--accent3)' }] }));
    const tot = (m) => val(d.ads, m) + val(d.paidMessages, m) + val(d.boosts, m);
    const cur = tot(months[5]); const prev = tot(months[4]);
    return `<div class="grid k4">${kpi('This month', rs(cur), prev ? `${cur >= prev ? '▲' : '▼'} ${Math.abs(pct(cur - prev, prev))}% vs last month` : '', cur >= prev ? 'up' : 'dn')}${kpi('Ads', rs(val(d.ads, months[5])), 'payments recorded this month')}${kpi('Paid messages + Spark boosts', rs(val(d.paidMessages, months[5]) + val(d.boosts, months[5])), 'from app users')}${kpi('Premium users', fmt(d.premiumUsers), 'accounts with Premium')}</div>
<div class="panel mt"><h3>Money in, by month</h3>${columns(items, { h: 220 })}<div class="legend"><span><i style="background:var(--accent)"></i>Ads</span><span><i style="background:var(--accent2)"></i>Paid messages</span><span><i style="background:var(--accent3)"></i>Spark boosts</span></div></div>`;
  };

  VIEWS.safety = async () => {
    const d = await api('/safety'); const s = d.summary || {};
    const left = (at) => 36 - Math.round((Date.now() - new Date(at)) / 3600000);
    return `<div class="grid k4">${kpi('Reports waiting', fmt(s.open_), `${fmt(s.reports30)} in the last 30 days`, N(s.open_) ? 'wa' : 'up')}${kpi('Copyright notices', fmt(s.copyright), 'must be acted on within 36 hours', N(s.copyright) ? 'dn' : 'up')}${kpi('Banned, last 30 days', fmt(s.bans30), 'banned faces can never return')}${kpi('Kinds of reports', fmt(d.byReason.length), 'open right now')}</div>
${d.copyright.length ? `<div class="panel mt"><h3>Copyright notices<span class="r">36-hour rule</span></h3><div class="tw"><table><tr><th>Rights owner</th><th>Content</th><th>Received</th><th>Time left</th></tr>${d.copyright.map((x) => { const l = left(x.created_at); return `<tr><td><b>${esc(x.rights_owner)}</b></td><td>${esc(x.content_kind)}</td><td>${dtt(x.created_at)}</td><td><span class="pill ${l <= 6 ? 'p-bad' : 'p-warn'}">${l > 0 ? `${l} h left` : `${-l} h late`}</span></td></tr>`; }).join('')}</table></div><p class="small mu">Decide these in the app's admin screen until that moves here.</p></div>` : ''}
<div class="grid c12 mt"><div class="panel"><h3>Open reports by reason</h3>${bars(d.byReason.map((x) => [`${x.reason} (${x.target_type})`, N(x.n)]))}</div>
<div class="panel"><h3>Report queue<span class="r">oldest first</span></h3><div class="tw"><table><tr><th>About</th><th>Reason</th><th class="n">Times</th><th>Waiting</th><th></th></tr>
${d.queue.map((x) => `<tr><td>${esc(x.target_type)}${x.target_user ? ` · @${esc(x.target_user)}` : ''}</td><td>${esc(x.reason)}</td><td class="n">${x.times}</td><td class="mu">${ago(x.created_at)}</td><td><select data-rep="${x.id}" aria-label="Decision"><option value="">Decide…</option><option value="actioned">Action taken</option><option value="dismissed">Dismiss</option><option value="reviewed">Reviewed</option></select></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No open reports.</td></tr>'}
</table></div><p class="small mu">Moderators see only what was reported, never a full private chat.</p></div></div>`;
  };
  AFTER.safety = () => { document.querySelectorAll('[data-rep]').forEach((s) => { s.onchange = async () => { if (!s.value) return; await api('/safety/reports/' + s.dataset.rep, { method: 'POST', body: { status: s.value } }); toast('Report updated'); render(); }; }); };

  VIEWS.team = async () => {
    const d = await api('/team'); const RN = { owner: 'Owner', ads: 'Ads manager', support: 'Support & safety', viewer: 'Viewer' };
    return `<div class="grid c12"><div class="panel"><h3>Roles</h3>
<div class="alert"><div><b>Owner</b><div class="small mu">Everything, including team and money</div></div></div><div class="alert"><div><b>Ads manager</b><div class="small mu">Customers, bookings, payments, ad reports</div></div></div>
<div class="alert"><div><b>Support & safety</b><div class="small mu">Issues, reports, releases (read)</div></div></div><div class="alert"><div><b>Viewer</b><div class="small mu">Read-only dashboards (investors, advisors)</div></div></div>
<p class="small mu">Sign-in: email + password + a 6-digit code from Google Authenticator. Locked for 15 minutes after 5 wrong tries.</p></div>
<div class="panel"><h3>Team<span class="r"><button class="btn sm pri" id="inv">+ Invite</button></span></h3><div class="tw"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr>
${d.team.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="small">${esc(x.email)}</td><td>${RN[x.role]}</td><td class="mu small">${x.disabled_at ? '<span class="pill p-dim">Turned off</span>' : x.invited ? '<span class="pill p-acc">Invited</span>' : ago(x.last_login_at)}</td><td>${!x.disabled_at && String(x.id).toLowerCase() !== String(C.me().id).toLowerCase() ? `<button class="btn sm" data-off="${x.id}">Turn off</button>` : ''}</td></tr>`).join('')}</table></div>
<h3 class="mt">Activity log</h3><div class="small" style="line-height:1.9">${d.log.map((l) => `<div><span class="mu">${dtt(l.created_at)}</span> · <b>${esc(l.actor_name || '—')}</b> ${esc(l.action)}</div>`).join('') || '<div class="empty">Nothing yet</div>'}</div></div></div>`;
  };
  AFTER.team = () => {
    $('#inv').onclick = () => modal('Invite someone', `<div class="form"><label>Name<input id="m1" required></label><label>Email<input id="m2" type="email" required></label><label>Role<select id="m3"><option value="ads">Ads manager</option><option value="support">Support & safety</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select></label></div>`,
      async () => { const email = $('#m2').value; const r = await api('/team', { method: 'POST', body: { name: $('#m1').value, email, role: $('#m3').value } });
        setTimeout(() => modal('Invite created', `<p>Send these to <b>${esc(email)}</b> yourself (WhatsApp or email):</p><div class="note" style="user-select:all">Console: ${location.origin}/#accept<br>Email: ${esc(email)}<br>Invite code: <b>${esc(r.inviteCode)}</b></div>`, null), 50); render(); });
    document.querySelectorAll('[data-off]').forEach((b) => { b.onclick = () => modal('Turn off this account?', '<p>They will be signed out and can’t sign in again until re-invited.</p>', async () => { await api(`/team/${b.dataset.off}/disable`, { method: 'POST' }); toast('Account turned off'); render(); }, 'Turn off'); });
  };

  // ---------- shared: modal + download ----------
  function modal(title, body, onOk, okText = 'Save') {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><form id="mf">${body}<div class="err" id="merr"></div><div class="row-actions"><button type="button" class="btn" id="mc">${onOk ? 'Cancel' : 'Close'}</button>${onOk ? `<button class="btn pri">${okText}</button>` : ''}</div></form></div>`;
    document.body.appendChild(m); const close = () => m.remove();
    m.querySelector('#mc').onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelector('#mf').onsubmit = async (e) => { e.preventDefault(); if (!onOk) return close(); const b = m.querySelector('.btn.pri'); b.disabled = true; try { await onOk(); close(); } catch (x) { m.querySelector('#merr').textContent = x.message; b.disabled = false; } };
    m.querySelector('input,select,textarea')?.focus();
  }
  function download(name, data, type) { const b = data instanceof Blob ? data : new Blob([data], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  Object.assign(C, { modal, download, day, PLAT });
})();
