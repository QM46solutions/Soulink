// Soulink team console. Talks to the Soulink server (/console/...) with its own sign-in.
(function () {
  const { line, columns, bars, donut, spark, heat, fmt, short, esc } = window.Charts;
  const API = (window.SOULINK_API || '').replace(/\/$/, '');
  const $ = (s, el = document) => el.querySelector(s);
  const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const N = (x) => Number(x || 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const dtt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
  const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 3600); }

  let token = null; let me = null;
  try { token = sessionStorage.getItem('slc_token'); } catch { /* private mode */ }
  const saveToken = (t) => { token = t; try { t ? sessionStorage.setItem('slc_token', t) : sessionStorage.removeItem('slc_token'); } catch { /* ignore */ } };

  async function api(path, { method = 'GET', body, form } = {}) {
    const headers = {}; if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try { res = await fetch(API + '/console' + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) }); }
    catch { throw new Error('Can’t reach the Soulink server. If it was asleep it can take up to a minute to wake up — try again.'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { saveToken(null); me = null; showAuth(); }
    if (!res.ok) throw new Error(data?.error?.message || `Something went wrong (${res.status})`);
    return data;
  }

  // a private file (e.g. a report's screenshot), fetched with the console sign-in
  async function apiBlob(path) {
    const res = await fetch(API + '/console' + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`Couldn't load it (${res.status})`);
    return res.blob();
  }

  // ---------- sign-in / setup / accept invite ----------
  function authCard(inner) { $('#root').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="color:var(--fg);padding:0 0 10px"><img class="logo" src="logo.png" alt="Soulink" width="34" height="34"><div>Soulink<small style="color:var(--dim)">TEAM CONSOLE</small></div></div>${inner}</div></div>`; }
  async function showAuth() {
    let st = { needsSetup: false, setupEnabled: false };
    try { st = await api('/auth/state'); } catch (e) { authCard(`<h1>Can’t connect</h1><p class="small mu">${esc(e.message)}</p><button class="btn pri" id="retry">Try again</button>`); $('#retry').onclick = showAuth; return; }
    if (location.hash === '#accept') return showAccept();
    if (st.needsSetup) return showSetup(st);
    authCard(`<h1>Sign in</h1><div class="small mu">For the Soulink team only.</div>
      <form id="f"><label>Email<input id="em" type="email" autocomplete="username" required></label>
      <label>Password<input id="pw" type="password" autocomplete="current-password" required></label>
      <label>6-digit code from Google Authenticator<input id="cd" inputmode="numeric" maxlength="6" pattern="\\d{6}" autocomplete="one-time-code" required></label>
      <div class="err" id="er"></div><button class="btn pri" style="justify-content:center">Sign in</button>
      <a href="#accept" class="small" style="text-align:center">I have an invite code</a></form>`);
    $('#f').onsubmit = async (e) => { e.preventDefault(); $('#er').textContent = '';
      try { const r = await api('/auth/login', { method: 'POST', body: { email: $('#em').value, password: $('#pw').value, code: $('#cd').value } }); saveToken(r.token); me = r.me; location.hash = ''; boot(); }
      catch (x) { $('#er').textContent = x.message; } };
    window.onhashchange = () => { if (location.hash === '#accept' && !me) showAccept(); };
  }
  function qrInto(el, text) { el.innerHTML = ''; if (window.QRCode) new window.QRCode(el, { text, width: 168, height: 168 }); else el.textContent = text; }
  async function secretStep(email) { return api('/auth/new-secret', { method: 'POST', body: { email } }); }
  function showSetup(st) {
    if (!st.setupEnabled) { authCard(`<h1>Set up the console</h1><p class="small mu" style="line-height:1.6">Nobody has a console account yet. To create the first owner account, add <b>CONSOLE_SETUP_KEY</b> in Render (Soulink service › Environment) with a long secret of your choice, wait for the redeploy, then reload this page.</p><button class="btn" id="retry">Reload</button>`); $('#retry').onclick = showAuth; return; }
    authCard(`<h1>Create the owner account</h1><div class="small mu">One time only. You'll need the Google Authenticator app on your phone.</div>
      <form id="f"><label>Setup key (the CONSOLE_SETUP_KEY you set in Render)<input id="sk" type="password" required></label>
      <label>Your name<input id="nm" required maxlength="80"></label><label>Email<input id="em" type="email" required></label>
      <label>Password (at least 10 characters)<input id="pw" type="password" minlength="10" autocomplete="new-password" required></label>
      <div id="tot" hidden><div class="small mu">In Google Authenticator tap <b>+</b> › <b>Scan a QR code</b>:</div><div class="qr" id="qr"></div><div class="small mu" style="text-align:center;word-break:break-all">Or enter this key: <b id="sec"></b></div>
      <label class="mt">6-digit code shown in the app<input id="cd" inputmode="numeric" maxlength="6" pattern="\\d{6}"></label></div>
      <div class="err" id="er"></div><button class="btn pri" id="go" style="justify-content:center">Next</button></form>`);
    let secret = null;
    $('#f').onsubmit = async (e) => { e.preventDefault(); $('#er').textContent = '';
      try {
        if (!secret) { const s = await secretStep($('#em').value); secret = s.secret; $('#tot').hidden = false; $('#sec').textContent = secret; qrInto($('#qr'), s.otpauth); $('#cd').required = true; $('#go').textContent = 'Create account'; return; }
        const r = await api('/auth/setup', { method: 'POST', body: { setupKey: $('#sk').value, name: $('#nm').value, email: $('#em').value, password: $('#pw').value, secret, code: $('#cd').value } });
        saveToken(r.token); me = r.me; toast('Console set up. Welcome!'); boot();
      } catch (x) { $('#er').textContent = x.message; } };
  }
  function showAccept() {
    authCard(`<h1>Join the console</h1><div class="small mu">Use the invite code an owner gave you.</div>
      <form id="f"><label>Email<input id="em" type="email" required></label><label>Invite code<input id="ic" required></label>
      <label>Choose a password (at least 10 characters)<input id="pw" type="password" minlength="10" autocomplete="new-password" required></label>
      <div id="tot" hidden><div class="small mu">In Google Authenticator tap <b>+</b> › <b>Scan a QR code</b>:</div><div class="qr" id="qr"></div><div class="small mu" style="text-align:center;word-break:break-all">Or enter this key: <b id="sec"></b></div>
      <label class="mt">6-digit code shown in the app<input id="cd" inputmode="numeric" maxlength="6"></label></div>
      <div class="err" id="er"></div><button class="btn pri" id="go" style="justify-content:center">Next</button><a href="#" class="small" style="text-align:center">Back to sign in</a></form>`);
    let secret = null;
    $('#f').onsubmit = async (e) => { e.preventDefault(); $('#er').textContent = '';
      try {
        if (!secret) { const s = await secretStep($('#em').value); secret = s.secret; $('#tot').hidden = false; $('#sec').textContent = secret; qrInto($('#qr'), s.otpauth); $('#cd').required = true; $('#go').textContent = 'Join'; return; }
        const r = await api('/auth/accept', { method: 'POST', body: { email: $('#em').value, inviteCode: $('#ic').value.trim(), password: $('#pw').value, secret, code: $('#cd').value } });
        saveToken(r.token); me = r.me; location.hash = ''; boot();
      } catch (x) { $('#er').textContent = x.message; } };
    window.onhashchange = () => { if (location.hash !== '#accept' && !me) showAuth(); };
  }

  // ---------- shell ----------
  const ic = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.5 2.4 3.5 5.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5l1.5 1.5M15 5l-1.5 1.5M3 13h4M17 13h4M4 19l3-2M20 19l-3-2"/>', tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    mega: '<path d="M3 10v4l11 5V5z"/><path d="M14 8a4 4 0 0 1 0 8M6 14l1 6h3l-1-5"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    scale: '<path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', funnel: '<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
    rupee: '<path d="M6 4h12M6 8h12M14 20L7 12h3a4 4 0 0 0 0-8"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>', card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'
  };
  const PAGES = [
    { id: 'overview', t: 'Overview', i: 'home', g: 'App', roles: ['owner', 'viewer', 'support', 'ads'], s: 'The big picture of Soulink right now' },
    { id: 'users', t: 'Users', i: 'users', g: 'App', roles: ['owner', 'viewer'], s: 'Who is on Soulink: platform, age, gender and city' },
    { id: 'activity', t: 'Activity', i: 'clock', g: 'App', roles: ['owner', 'viewer'], s: 'When people use Soulink (Indian time)' },
    { id: 'growth', t: 'Growth funnel', i: 'funnel', g: 'App', roles: ['owner', 'viewer'], s: 'Where new users drop off, from sign-up to first connection' },
    { id: 'performance', t: 'Speed & server', i: 'gauge', g: 'Tech', roles: ['owner'], s: 'Server load, response times and the slowest screens' },
    { id: 'issues', t: 'Issues', i: 'bug', g: 'Tech', roles: ['owner', 'support', 'viewer'], s: 'Problems reported by users, crashes, and what the team is fixing' },
    { id: 'releases', t: 'Releases', i: 'tag', g: 'Tech', roles: ['owner', 'viewer', 'support', 'ads'], s: 'Every store version and over-the-air update, with what changed' },
    { id: 'ads', t: 'Ads & customers', i: 'mega', g: 'Business', roles: ['owner', 'ads', 'viewer'], s: 'Customers, their bookings, payments and ad performance' },
    { id: 'book', t: 'New ad booking', i: 'cal', g: 'Business', roles: ['owner', 'ads'], s: 'Book hours for a customer: placement, cities and schedule' },
    { id: 'rates', t: 'Ad rate card', i: 'card', g: 'Business', roles: ['owner', 'ads', 'viewer'], s: 'Hourly prices per placement and city' },
    { id: 'revenue', t: 'Revenue', i: 'rupee', g: 'Business', roles: ['owner', 'viewer'], s: 'Money in from ads, paid messages and Spreads' },
    { id: 'safety', t: 'Safety & reports', i: 'shield', g: 'Trust', roles: ['owner', 'support'], s: 'Reported users and content, copyright notices and bans' },
    { id: 'legal', t: 'Legal & compliance', i: 'scale', g: 'Trust', roles: ['owner', 'support'], s: 'Complaints to the Grievance Officer, police and court orders, and bans, with their legal deadlines' },
    { id: 'team', t: 'Team & access', i: 'key', g: 'Trust', roles: ['owner'], s: 'Who can sign in to this console, and what each person did' }
  ];
  const ROLE = { owner: 'Owner · full access', ads: 'Ads manager', support: 'Support & safety', viewer: 'Viewer · read-only' };
  const can = (p) => p.roles.includes(me.role);
  const canEdit = (...roles) => me.role === 'owner' || roles.includes(me.role);
  const st = {};

  function shell() {
    let g = ''; let nav = '';
    PAGES.filter(can).forEach((p) => { if (p.g !== g) { g = p.g; nav += `<div class="nav-h">${g}</div>`; } nav += `<a href="#${p.id}" data-id="${p.id}"><svg viewBox="0 0 24 24">${ic[p.i]}</svg>${p.t}<span class="ct" data-ct="${p.id}" hidden></span></a>`; });
    $('#root').innerHTML = `<div class="app"><aside class="rail" id="rail"><div class="brand"><img class="logo" src="logo.png" alt="Soulink" width="34" height="34"><div>Soulink<small>TEAM CONSOLE</small></div></div>
      <nav class="nav">${nav}</nav><div class="who"><b>${esc(me.name)}</b><span>${ROLE[me.role]}</span><br><button id="out">Sign out</button></div></aside>
      <main><div class="top"><button class="btn menu-btn" id="menuBtn" aria-label="Open menu">☰</button><div><h1 id="title"></h1><div class="sub" id="sub"></div></div><div class="sp"></div><span class="live" id="live" hidden></span><span class="stamp" id="stamp"></span><button class="btn sm" id="refresh">↻ Refresh</button></div><div id="view"></div></main></div>`;
    $('#out').onclick = () => { timers.forEach(clearInterval); timers = []; saveToken(null); me = null; showAuth(); };
    $('#menuBtn').onclick = () => $('#rail').classList.toggle('open');
    $('#refresh').onclick = () => render();
    window.onhashchange = () => { st.cust = null; render(); };
  }
  let shown = null; // the page on screen
  async function render(opts = {}) {
    let id = (location.hash || '').slice(1); let p = PAGES.find((x) => x.id === id && can(x)); if (!p) { p = PAGES.find(can); id = p.id; }
    const v = $('#view');
    if (opts.silent) {
      // auto-refresh: fetch first, swap only if nothing changed meanwhile, keep the scroll position, never flash "Loading"
      try {
        const html = await VIEWS[id]();
        if (id !== shown || !canAutoRefresh()) return;
        const y = window.scrollY; v.innerHTML = html; AFTER[id]?.(); window.scrollTo(0, y); stamp();
      } catch { /* keep what's on screen; the next try may work */ }
      return;
    }
    shown = id;
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === id));
    $('#title').textContent = p.t; $('#sub').textContent = p.s; $('#rail')?.classList.remove('open');
    v.innerHTML = '<div class="loading">Loading live numbers…</div>';
    try { v.innerHTML = await VIEWS[id](); stamp(); AFTER[id]?.(); }
    catch (e) { v.innerHTML = `<div class="panel"><b>Couldn’t load this page.</b><p class="mu">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reload</button></div>`; }
  }
  const stamp = () => { $('#stamp').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); };

  // ---------- live: the strip refreshes every 15 s, the page every 60 s ----------
  // Pages with forms (new booking, rate card, team) never refresh by themselves, and nothing refreshes while
  // a pop-up is open, someone is typing, a customer is open, or the tab is in the background.
  const AUTO = new Set(['overview', 'users', 'activity', 'growth', 'performance', 'issues', 'releases', 'revenue', 'safety', 'legal', 'ads']);
  function canAutoRefresh() {
    if (document.hidden || !me || document.querySelector('.modal')) return false;
    const f = document.activeElement; if (f && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName)) return false;
    if (shown === 'ads' && st.cust) return false;
    return AUTO.has(shown);
  }
  async function pollLive() {
    const e = $('#live'); if (!e || document.hidden || !me) return;
    try {
      const l = await api('/live'); st.live = l;
      const f = (x) => Number(x || 0).toLocaleString('en-IN');
      e.hidden = false; e.className = 'live';
      e.innerHTML = `<i></i><b>${f(l.online)}</b> online now · <b>${f(l.activeHour)}</b> this hour · <b>${f(l.signupsToday)}</b> new today`;
      e.title = `Active in the last 5 minutes: ${f(l.active5)}\nPeople today (since the server started): ${f(l.activeToday)}\nMessages in the last hour: ${f(l.messagesHour)}\nPosts and Sparks in the last hour: ${f(l.postsHour)}\nNew issues waiting: ${f(l.issuesNew)}\nServer up for ${f(l.uptimeMin)} min`;
      const ct = document.querySelector('[data-ct="issues"]'); if (ct) { ct.hidden = !l.issuesNew; ct.textContent = l.issuesNew || ''; }
    } catch { e.hidden = false; e.className = 'live off'; e.innerHTML = '<i></i>Server not answering'; }
  }
  let timers = [];
  function startLive() {
    timers.forEach(clearInterval);
    pollLive();
    timers = [setInterval(pollLive, 15_000), setInterval(() => { if (canAutoRefresh()) render({ silent: true }); }, 60_000)];
    document.onvisibilitychange = () => { if (!document.hidden && me) { pollLive(); if (canAutoRefresh()) render({ silent: true }); } };
  }
  async function boot() {
    if (!token) return showAuth();
    try { if (!me) me = (await api('/auth/me')).me; } catch { return showAuth(); }
    shell(); render(); startLive();
  }
  const kpi = (l, v, d = '', cls = 'mu', sp = '') => `<div class="panel kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d ${cls}">${d}</div>${sp}</div>`;
  const VIEWS = {}; const AFTER = {};
  window.__console = { api, apiBlob, VIEWS, AFTER, st, kpi, rs, N, pct, dt, dtt, ago, todayIST, toast, render, canEdit, me: () => me, $ };
  document.addEventListener('DOMContentLoaded', boot);
})();
