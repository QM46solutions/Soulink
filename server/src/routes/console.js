// The team console API (admin.qm46.in). Separate sign-in from the app. Everything here is aggregated:
// counts and groups only (groups under 10 people are hidden), never anyone's private content.
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, notFound, HttpError } from '../lib/errors.js';
import { checkPassword, checkTotp, hashPassword, newTotpSecret, otpauthUrl, requireConsole, signConsole } from '../lib/consoleAuth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { onlineNow } from '../realtime.js';
import { liveActivity } from '../services/metrics.js';
import { audit } from '../services/audit.js';
import { banAccount, BAN_DAYS } from '../services/lifecycle.js';
import { actOnOrder, addOrder, CATEGORIES, grievanceView, legalSummary, ORDER_HOURS, orderView, updateGrievance } from '../services/legal.js';

const r = Router();
const OWNER = requireConsole(); // owner-only when no extra roles are given
const ANY = requireConsole('owner', 'ads', 'support', 'viewer');
const TODAY = "CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+05:30') AS DATE)";
const IST_DATE = (col) => `CAST(SWITCHOFFSET(${col}, '+05:30') AS DATE)`;
const LIVE_USERS = 'u.deactivated_at IS NULL';
const n = (x) => Number(x || 0);
const log = (req, action) => query('INSERT INTO console_log (actor_id, actor_name, action) VALUES ($1, $2, $3)', [req.cu?.id || null, req.cu?.name || null, String(action).slice(0, 200)]).catch(() => {});
const small = (rows, key = 'n') => rows.filter((x) => n(x[key]) >= 10); // hide groups under 10 people
const pw = z.string().min(10, 'Use at least 10 characters').max(200);

// ---------- sign-in ----------
// First owner: only while nobody has a console account, and only with CONSOLE_SETUP_KEY (set in Render).
r.get('/auth/state', ah(async (req, res) => {
  const any = await one('SELECT TOP 1 1 AS x FROM console_users');
  res.json({ needsSetup: !any, setupEnabled: !!process.env.CONSOLE_SETUP_KEY });
}));
r.post('/auth/new-secret', ah(async (req, res) => {
  const d = z.object({ email: z.string().email() }).parse(req.body);
  const secret = newTotpSecret();
  res.json({ secret, otpauth: otpauthUrl(d.email, secret) });
}));
r.post('/auth/setup', ah(async (req, res) => {
  const d = z.object({ setupKey: z.string(), email: z.string().email(), name: z.string().trim().min(2).max(80), password: pw, secret: z.string().min(16).max(64), code: z.string() }).parse(req.body);
  const key = process.env.CONSOLE_SETUP_KEY || '';
  if (!key || d.setupKey.length !== key.length || !crypto.timingSafeEqual(Buffer.from(d.setupKey), Buffer.from(key))) throw new HttpError(403, 'Setup key is wrong', 'console_setup');
  if (await one('SELECT TOP 1 1 AS x FROM console_users')) throw new HttpError(409, 'The console is already set up. Sign in instead.', 'console_setup_done');
  if (!checkTotp(d.secret, d.code)) throw badRequest('The 6-digit code did not match. Check the time on your phone and try the newest code.', 'bad_code');
  const u = await one(`INSERT INTO console_users (email, name, role, pw_hash, totp_secret) OUTPUT INSERTED.id, INSERTED.role, INSERTED.name, INSERTED.email
    VALUES ($1, $2, N'owner', $3, $4)`, [d.email.toLowerCase(), d.name, hashPassword(d.password), d.secret]);
  req.cu = u; log(req, 'Set up the console (first owner)');
  res.json({ token: signConsole(u), me: u });
}));
// Someone invited by an owner sets their password and authenticator.
r.post('/auth/accept', ah(async (req, res) => {
  const d = z.object({ email: z.string().email(), inviteCode: z.string().min(8), password: pw, secret: z.string().min(16).max(64), code: z.string() }).parse(req.body);
  const u = await one('SELECT * FROM console_users WHERE email=$1 AND disabled_at IS NULL', [d.email.toLowerCase()]);
  if (!u?.invite_code || u.invite_code !== d.inviteCode) throw badRequest('Invite code or email is wrong', 'bad_invite');
  if (!checkTotp(d.secret, d.code)) throw badRequest('The 6-digit code did not match. Try the newest code.', 'bad_code');
  await query('UPDATE console_users SET pw_hash=$2, totp_secret=$3, invite_code=NULL WHERE id=$1', [u.id, hashPassword(d.password), d.secret]);
  req.cu = u; log(req, 'Accepted invite and set up sign-in');
  res.json({ token: signConsole(u), me: { id: u.id, email: u.email, name: u.name, role: u.role } });
}));
r.post('/auth/login', ah(async (req, res) => {
  const d = z.object({ email: z.string().email(), password: z.string().max(200), code: z.string().max(10) }).parse(req.body);
  const u = await one('SELECT * FROM console_users WHERE email=$1', [d.email.toLowerCase()]);
  const fail = () => new HttpError(401, 'Email, password or code is wrong', 'console_bad_login');
  if (!u || u.disabled_at || !u.pw_hash) throw fail();
  if (u.locked_until && new Date(u.locked_until) > new Date()) throw new HttpError(429, 'Too many wrong tries. Try again in 15 minutes.', 'console_locked');
  if (!checkPassword(d.password, u.pw_hash) || !checkTotp(u.totp_secret, d.code)) {
    await query(`UPDATE console_users SET failed = failed + 1, locked_until = CASE WHEN failed + 1 >= 5 THEN DATEADD(minute, 15, SYSDATETIMEOFFSET()) ELSE locked_until END WHERE id=$1`, [u.id]);
    throw fail();
  }
  await query('UPDATE console_users SET failed=0, locked_until=NULL, last_login_at=SYSDATETIMEOFFSET() WHERE id=$1', [u.id]);
  res.json({ token: signConsole(u), me: { id: u.id, email: u.email, name: u.name, role: u.role } });
}));
r.get('/auth/me', ANY, ah(async (req, res) => res.json({ me: req.cu })));

// ---------- team ----------
r.get('/team', OWNER, ah(async (req, res) => {
  const team = await many('SELECT id, email, name, role, last_login_at, disabled_at, CASE WHEN invite_code IS NULL THEN 0 ELSE 1 END AS invited FROM console_users ORDER BY created_at');
  const logRows = await many('SELECT TOP 60 actor_name, action, created_at FROM console_log ORDER BY id DESC');
  res.json({ team, log: logRows });
}));
r.post('/team', OWNER, ah(async (req, res) => {
  const d = z.object({ email: z.string().email(), name: z.string().trim().min(2).max(80), role: z.enum(['owner', 'ads', 'support', 'viewer']) }).parse(req.body);
  const code = crypto.randomBytes(9).toString('base64url');
  const ex = await one('SELECT id FROM console_users WHERE email=$1', [d.email.toLowerCase()]);
  if (ex) await query('UPDATE console_users SET name=$2, role=$3, invite_code=$4, disabled_at=NULL WHERE id=$1', [ex.id, d.name, d.role, code]);
  else await query('INSERT INTO console_users (email, name, role, invite_code) VALUES ($1, $2, $3, $4)', [d.email.toLowerCase(), d.name, d.role, code]);
  log(req, `Invited ${d.name} (${d.role})`);
  res.json({ inviteCode: code });
}));
r.post('/team/:id/disable', OWNER, ah(async (req, res) => {
  if (String(req.params.id).toLowerCase() === String(req.cu.id).toLowerCase()) throw badRequest("You can't turn off your own account");
  await query('UPDATE console_users SET disabled_at=SYSDATETIMEOFFSET() WHERE id=$1', [req.params.id]);
  log(req, 'Turned off a console account');
  res.json({ ok: true });
}));

// ---------- shared SQL ----------
// platform: the push token says it; otherwise the phone's network library in the latest login (okhttp = Android, Darwin = iPhone)
const PLATFORM_SQL = `(SELECT TOP 1 CASE
    WHEN EXISTS (SELECT 1 FROM expo_push_tokens t WHERE t.user_id = u.id AND t.platform = N'android') THEN N'android'
    WHEN EXISTS (SELECT 1 FROM expo_push_tokens t WHERE t.user_id = u.id AND t.platform = N'ios') THEN N'ios'
    WHEN s.device LIKE N'%okhttp%' OR s.device LIKE N'%Android%' THEN N'android'
    WHEN s.device LIKE N'%Darwin%' OR s.device LIKE N'%iPhone%' THEN N'ios'
    ELSE N'web' END FROM (SELECT TOP 1 device FROM user_sessions s WHERE s.user_id = u.id ORDER BY s.last_seen_at DESC) s)`;
const AGE_SQL = `CASE WHEN u.birth_date IS NULL THEN N'Not said'
    WHEN DATEDIFF(day, u.birth_date, GETDATE()) / 365 <= 21 THEN N'18–21'
    WHEN DATEDIFF(day, u.birth_date, GETDATE()) / 365 <= 25 THEN N'22–25'
    WHEN DATEDIFF(day, u.birth_date, GETDATE()) / 365 <= 30 THEN N'26–30'
    WHEN DATEDIFF(day, u.birth_date, GETDATE()) / 365 <= 35 THEN N'31–35' ELSE N'36+' END`;
const GENDER_SQL = `CASE WHEN LOWER(u.gender) IN (N'male', N'man', N'm') THEN N'Men' WHEN LOWER(u.gender) IN (N'female', N'woman', N'f') THEN N'Women' ELSE N'Other / not said' END`;

async function latestMetrics() {
  const m = await one('SELECT TOP 1 * FROM server_metrics ORDER BY at DESC');
  const wk = await one(`SELECT SUM(requests) AS req, SUM(errors) AS err, AVG(p50_ms) AS p50, MAX(p95_ms) AS p95 FROM server_metrics WHERE at > DATEADD(day, -7, SYSDATETIMEOFFSET())`);
  return { latest: m, week: wk, uptimeHours: Math.round(process.uptime() / 360) / 10, rssMb: Math.round(process.memoryUsage().rss / 1048576) };
}

// ---------- overview ----------
r.get('/overview', ANY, ah(async (req, res) => {
  const t = await one(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN u.face_verified = 1 THEN 1 ELSE 0 END) AS verified,
      SUM(CASE WHEN u.soul_ready = 1 THEN 1 ELSE 0 END) AS soul,
      SUM(CASE WHEN u.last_active_at >= CAST(${TODAY} AS DATETIMEOFFSET) THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN u.last_active_at > DATEADD(day, -7, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS week,
      SUM(CASE WHEN u.last_active_at > DATEADD(day, -30, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS month,
      SUM(CASE WHEN u.created_at > DATEADD(day, -30, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS new30,
      SUM(CASE WHEN u.created_at > DATEADD(day, -1, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS new1
    FROM users u WHERE ${LIVE_USERS} AND u.username IS NOT NULL`);
  const plat = await many(`SELECT p, COUNT(*) AS n FROM (SELECT ${PLATFORM_SQL} AS p FROM users u WHERE ${LIVE_USERS} AND u.username IS NOT NULL) x GROUP BY p`);
  const signups = await many(`SELECT ${IST_DATE('created_at')} AS day, COUNT(*) AS n FROM users u WHERE ${LIVE_USERS} AND u.username IS NOT NULL AND created_at > DATEADD(day, -30, SYSDATETIMEOFFSET()) GROUP BY ${IST_DATE('created_at')}`);
  const before = await one(`SELECT COUNT(*) AS n FROM users u WHERE ${LIVE_USERS} AND u.username IS NOT NULL AND created_at <= DATEADD(day, -30, SYSDATETIMEOFFSET())`);
  const dau = await many(`SELECT day, users FROM activity_daily WHERE day > DATEADD(day, -30, ${TODAY}) ORDER BY day`);
  const c = await one(`SELECT (SELECT COUNT(*) FROM connections) AS connections,
      (SELECT COUNT(*) FROM posts WHERE created_at > DATEADD(day, -1, SYSDATETIMEOFFSET())) AS posts24,
      (SELECT COUNT(*) FROM sparks WHERE created_at > DATEADD(day, -1, SYSDATETIMEOFFSET())) AS sparks24,
      (SELECT COUNT(*) FROM messages WHERE created_at > DATEADD(day, -1, SYSDATETIMEOFFSET())) AS messages24,
      (SELECT COUNT(*) FROM reports WHERE status = N'open') AS reportsOpen,
      (SELECT COUNT(*) FROM copyright_reports WHERE status = N'received') AS copyrightOpen,
      (SELECT MIN(created_at) FROM copyright_reports WHERE status = N'received') AS copyrightOldest,
      (SELECT COUNT(*) FROM app_issues WHERE status IN (N'new', N'progress')) AS issuesOpen,
      (SELECT COUNT(*) FROM app_issues WHERE status IN (N'new', N'progress') AND severity IN (N'critical', N'high')) AS issuesUrgent,
      (SELECT ISNULL(SUM(amount), 0) FROM ad_payments WHERE paid_on >= DATEFROMPARTS(YEAR(${TODAY}), MONTH(${TODAY}), 1)) AS adPaidMonth,
      (SELECT ISNULL(SUM(total), 0) FROM ad_bookings WHERE status <> N'cancelled') - (SELECT ISNULL(SUM(amount), 0) FROM ad_payments) AS adDue,
      (SELECT COUNT(*) FROM ad_campaigns WHERE active = 1 AND starts_at <= SYSDATETIMEOFFSET() AND ends_at > SYSDATETIMEOFFSET()) AS adsLive`).catch(() => ({}));
  const peak = await one(`SELECT TOP 1 hour, AVG(users) AS u FROM activity_hourly WHERE day > DATEADD(day, -14, ${TODAY}) GROUP BY hour ORDER BY AVG(users) DESC`);
  const release = await one('SELECT TOP 1 * FROM app_releases ORDER BY released_on DESC, id DESC');
  // a running total of users for the last 30 days
  let run = n(before?.n); const byDay = Object.fromEntries(signups.map((s) => [new Date(s.day).toISOString().slice(0, 10), n(s.n)]));
  const growth = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() + 330 * 60_000 - i * 86400_000).toISOString().slice(0, 10); run += byDay[d] || 0; growth.push({ day: d, users: run, signups: byDay[d] || 0 }); }
  res.json({ totals: t, platforms: Object.fromEntries(plat.map((p) => [p.p, n(p.n)])), growth, dau: dau.map((d) => ({ day: new Date(d.day).toISOString().slice(0, 10), users: n(d.users) })),
    counts: c, peakHour: peak ? { hour: n(peak.hour), users: Math.round(n(peak.u)) } : null, release, server: await latestMetrics() });
}));

// ---------- live (the console checks this every 15 seconds) ----------
// Light on purpose: who has the app open now and this hour come from memory; the rest is 5 small counts.
r.get('/live', ANY, ah(async (req, res) => {
  const mem = liveActivity();
  const c = await one(`SELECT
      (SELECT COUNT(*) FROM users WHERE last_active_at > DATEADD(minute, -5, SYSDATETIMEOFFSET()) AND deactivated_at IS NULL) AS active5,
      (SELECT COUNT(*) FROM users WHERE created_at >= CAST(${TODAY} AS DATETIMEOFFSET) AND username IS NOT NULL) AS signupsToday,
      (SELECT COUNT(*) FROM messages WHERE created_at > DATEADD(hour, -1, SYSDATETIMEOFFSET())) AS messagesHour,
      (SELECT COUNT(*) FROM posts WHERE created_at > DATEADD(hour, -1, SYSDATETIMEOFFSET())) + (SELECT COUNT(*) FROM sparks WHERE created_at > DATEADD(hour, -1, SYSDATETIMEOFFSET())) AS postsHour,
      (SELECT COUNT(*) FROM app_issues WHERE status = N'new') AS issuesNew`).catch(() => ({}));
  res.json({ at: new Date().toISOString(), online: onlineNow(), activeHour: mem.activeHour, activeToday: mem.activeToday,
    active5: n(c.active5), signupsToday: n(c.signupsToday), messagesHour: n(c.messagesHour), postsHour: n(c.postsHour), issuesNew: n(c.issuesNew), uptimeMin: Math.round(process.uptime() / 60) });
}));

// ---------- users ----------
r.get('/users', requireConsole('viewer'), ah(async (req, res) => {
  const f = z.object({ city: z.string().max(60).optional(), gender: z.string().max(20).optional(), age: z.string().max(10).optional(), platform: z.enum(['android', 'ios', 'web']).optional() }).parse(req.query);
  const rows = await many(`SELECT ISNULL(NULLIF(LTRIM(RTRIM(u.city)), N''), N'Not said') AS city, ${GENDER_SQL} AS gender, ${AGE_SQL} AS age, ${PLATFORM_SQL} AS platform,
      CASE WHEN u.last_active_at > DATEADD(day, -7, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END AS active7
    FROM users u WHERE ${LIVE_USERS} AND u.username IS NOT NULL`);
  const pick = rows.filter((x) => (!f.city || x.city.toLowerCase() === f.city.toLowerCase()) && (!f.gender || x.gender === f.gender) && (!f.age || x.age === f.age) && (!f.platform || x.platform === f.platform));
  const group = (k) => Object.entries(pick.reduce((a, x) => { a[x[k]] = (a[x[k]] || 0) + 1; return a; }, {})).map(([key, v]) => ({ key, n: v })).sort((a, b) => b.n - a.n);
  const hide = (g) => { const shown = g.filter((x) => x.n >= 10); const hidden = g.filter((x) => x.n < 10).reduce((s, x) => s + x.n, 0); return hidden ? [...shown, { key: 'Smaller groups', n: hidden }] : shown; };
  const cities = [...new Set(rows.map((x) => x.city))].filter((c) => rows.filter((x) => x.city === c).length >= 10).sort();
  res.json({ total: pick.length, active7: pick.filter((x) => x.active7).length, gender: hide(group('gender')), age: hide(group('age')), city: hide(group('city')).slice(0, 20),
    platform: group('platform'), cities, areaTracked: false });
}));

// ---------- activity ----------
r.get('/activity', requireConsole('viewer'), ah(async (req, res) => {
  const cells = await many(`SELECT (DATEPART(weekday, day) + @@DATEFIRST - 2) % 7 AS wd, hour, AVG(users) AS u FROM activity_hourly WHERE day > DATEADD(day, -28, ${TODAY}) GROUP BY (DATEPART(weekday, day) + @@DATEFIRST - 2) % 7, hour`);
  const days = await many(`SELECT COUNT(*) AS n FROM activity_daily`);
  const today = await many(`SELECT hour, users FROM activity_hourly WHERE day = ${TODAY} ORDER BY hour`);
  res.json({ cells: cells.map((c) => ({ wd: n(c.wd), hour: n(c.hour), users: n(c.u) })), today: today.map((x) => ({ hour: n(x.hour), users: n(x.users) })), daysRecorded: n(days[0]?.n) });
}));

// ---------- growth funnel (people who joined in the last 90 days) ----------
r.get('/growth', requireConsole('viewer'), ah(async (req, res) => {
  const f = await one(`SELECT COUNT(*) AS joined,
      SUM(CASE WHEN u.username IS NOT NULL THEN 1 ELSE 0 END) AS profile,
      SUM(CASE WHEN u.face_verified = 1 THEN 1 ELSE 0 END) AS face,
      SUM(CASE WHEN u.soul_ready = 1 THEN 1 ELSE 0 END) AS soul,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM connection_requests q WHERE q.from_id = u.id) THEN 1 ELSE 0 END) AS requested,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM connections c WHERE c.user_a = u.id OR c.user_b = u.id) THEN 1 ELSE 0 END) AS connected,
      SUM(CASE WHEN u.last_active_at > DATEADD(day, 7, u.created_at) THEN 1 ELSE 0 END) AS week2
    FROM users u WHERE u.created_at > DATEADD(day, -90, SYSDATETIMEOFFSET())`);
  res.json({ funnel: f });
}));

// ---------- speed & server ----------
r.get('/performance', OWNER, ah(async (req, res) => {
  const series = await many(`SELECT CAST(SWITCHOFFSET(at, '+05:30') AS DATE) AS day, SUM(requests) AS req, SUM(errors) AS err, AVG(p50_ms) AS p50, MAX(p95_ms) AS p95, MAX(cpu_pct) AS cpu, MAX(rss_mb) AS mem
    FROM server_metrics WHERE at > DATEADD(day, -14, SYSDATETIMEOFFSET()) GROUP BY CAST(SWITCHOFFSET(at, '+05:30') AS DATE) ORDER BY day`);
  const recent = await many('SELECT TOP 288 at, requests, p50_ms, p95_ms, cpu_pct, rss_mb, slowest FROM server_metrics ORDER BY at DESC');
  const screens = await many(`SELECT screen, platform, COUNT(*) AS n, AVG(ms) AS avg_ms, MAX(ms) AS max_ms FROM screen_timings WHERE created_at > DATEADD(day, -7, SYSDATETIMEOFFSET()) GROUP BY screen, platform ORDER BY AVG(ms) DESC`);
  const db = await one('SELECT CAST(SUM(CAST(size AS BIGINT)) * 8 / 1024 AS INT) AS mb FROM sys.database_files').catch(() => null);
  const slowCalls = {}; for (const row of recent) { try { for (const [k, ms, cnt] of JSON.parse(row.slowest || '[]')) { const s = slowCalls[k] || { ms: 0, n: 0 }; s.ms = Math.max(s.ms, ms); s.n += cnt; slowCalls[k] = s; } } catch { /* skip */ } }
  res.json({ series, recent: recent.reverse(), screens, dbMb: db?.mb ?? null, server: await latestMetrics(),
    slowCalls: Object.entries(slowCalls).map(([k, v]) => ({ call: k, ms: v.ms, n: v.n })).sort((a, b) => b.ms - a.ms).slice(0, 8) });
}));

// ---------- issues ----------
const ISSUE_STATUS = ['new', 'progress', 'fixed', 'released', 'wontfix'];
r.get('/issues', requireConsole('support', 'viewer'), ah(async (req, res) => {
  const rows = await many('SELECT TOP 300 * FROM app_issues ORDER BY CASE WHEN status IN (N\'new\', N\'progress\') THEN 0 ELSE 1 END, CASE severity WHEN N\'critical\' THEN 0 WHEN N\'high\' THEN 1 WHEN N\'medium\' THEN 2 ELSE 3 END, updated_at DESC');
  const s = await one(`SELECT COUNT(*) AS total, SUM(CASE WHEN status IN (N'new', N'progress') THEN 1 ELSE 0 END) AS open_,
      SUM(CASE WHEN status = N'fixed' THEN 1 ELSE 0 END) AS waiting, SUM(CASE WHEN status IN (N'fixed', N'released') AND updated_at > DATEADD(day, -30, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS fixed30 FROM app_issues`);
  res.json({ issues: rows, summary: s });
}));
r.post('/issues', requireConsole('support'), ah(async (req, res) => {
  const d = z.object({ title: z.string().trim().min(3).max(200), details: z.string().max(2000).optional(), severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium') }).parse(req.body);
  const x = await one(`INSERT INTO app_issues (title, details, source, severity, owner) OUTPUT INSERTED.id VALUES ($1, $2, N'team', $3, $4)`, [d.title, d.details || null, d.severity, req.cu.name]);
  log(req, `Added issue SL-${x.id}`); res.json({ id: x.id });
}));
r.patch('/issues/:id', requireConsole('support'), ah(async (req, res) => {
  const d = z.object({ status: z.enum(ISSUE_STATUS).optional(), severity: z.enum(['critical', 'high', 'medium', 'low']).optional(), owner: z.string().max(80).optional(), fixedIn: z.string().max(30).optional() }).parse(req.body);
  const id = z.coerce.number().int().parse(req.params.id);
  await query(`UPDATE app_issues SET status = ISNULL($2, status), severity = ISNULL($3, severity), owner = ISNULL($4, owner), fixed_in = ISNULL($5, fixed_in), updated_at = SYSDATETIMEOFFSET() WHERE id=$1`,
    [id, d.status || null, d.severity || null, d.owner || null, d.fixedIn || null]);
  log(req, `Updated issue SL-${id}${d.status ? ` → ${d.status}` : ''}`); res.json({ ok: true });
}));

// ---------- releases ----------
r.get('/releases', requireConsole('viewer', 'support', 'ads'), ah(async (req, res) => {
  const rows = await many('SELECT * FROM app_releases ORDER BY released_on DESC, id DESC');
  res.json({ releases: rows.map((x) => ({ ...x, features: JSON.parse(x.features || '[]'), fixes: JSON.parse(x.fixes || '[]') })) });
}));
const relBody = z.object({ version: z.string().trim().min(1).max(40), channel: z.enum(['play', 'appstore', 'ota', 'apk']), track: z.string().max(40).optional(), status: z.string().trim().min(1).max(30),
  releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), features: z.array(z.string().max(300)).max(40).default([]), fixes: z.array(z.string().max(300)).max(40).default([]) });
r.post('/releases', OWNER, ah(async (req, res) => {
  const d = relBody.parse(req.body);
  await query('INSERT INTO app_releases (version, channel, track, status, released_on, features, fixes) VALUES ($1,$2,$3,$4,$5,$6,$7)', [d.version, d.channel, d.track || null, d.status, d.releasedOn, JSON.stringify(d.features), JSON.stringify(d.fixes)]);
  log(req, `Added release ${d.version}`); res.json({ ok: true });
}));
r.patch('/releases/:id', OWNER, ah(async (req, res) => {
  const d = relBody.partial().parse(req.body); const id = z.coerce.number().int().parse(req.params.id);
  await query(`UPDATE app_releases SET status = ISNULL($2, status), version = ISNULL($3, version), features = ISNULL($4, features), fixes = ISNULL($5, fixes) WHERE id=$1`,
    [id, d.status || null, d.version || null, d.features ? JSON.stringify(d.features) : null, d.fixes ? JSON.stringify(d.fixes) : null]);
  log(req, `Updated release #${id}`); res.json({ ok: true });
}));

// ---------- safety ----------
r.get('/safety', requireConsole('support'), ah(async (req, res) => {
  const s = await one(`SELECT (SELECT COUNT(*) FROM reports WHERE status = N'open') AS open_,
      (SELECT COUNT(*) FROM copyright_reports WHERE status = N'received') AS copyright,
      (SELECT COUNT(*) FROM banned_identities WHERE kind = N'ban' AND created_at > DATEADD(day, -30, SYSDATETIMEOFFSET())) AS bans30,
      (SELECT COUNT(*) FROM reports WHERE created_at > DATEADD(day, -30, SYSDATETIMEOFFSET())) AS reports30`).catch(() => ({}));
  const byReason = await many(`SELECT reason, target_type, COUNT(*) AS n FROM reports WHERE status = N'open' GROUP BY reason, target_type ORDER BY COUNT(*) DESC`);
  const queue = await many(`SELECT TOP 50 r.id, r.target_type, r.reason, r.created_at, t.username AS target_user,
      (SELECT COUNT(*) FROM reports r2 WHERE r2.target_id = r.target_id AND r2.status = N'open') AS times
    FROM reports r LEFT JOIN users t ON r.target_type = N'user' AND t.id = r.target_id WHERE r.status = N'open' ORDER BY r.created_at`);
  const copyright = await many(`SELECT TOP 30 id, rights_owner, content_kind, created_at FROM copyright_reports WHERE status = N'received' ORDER BY created_at`);
  res.json({ summary: s, byReason, queue, copyright });
}));
r.post('/safety/reports/:id', requireConsole('support'), ah(async (req, res) => {
  const d = z.object({ status: z.enum(['reviewed', 'actioned', 'dismissed']) }).parse(req.body);
  await query('UPDATE reports SET status=$2 WHERE id=$1', [req.params.id, d.status]);
  log(req, `Marked a report ${d.status}`); res.json({ ok: true });
}));

// ---------- legal: complaints, lawful orders, bans ----------
// Complaints and orders: support + owner. Bans erase an account, so only the owner can ban or lift one.
r.get('/legal', requireConsole('support'), ah(async (req, res) => {
  const status = z.enum(['open', 'closed', 'all']).default('open').parse(req.query.status || 'open');
  const gWhere = status === 'open' ? "WHERE status IN (N'open', N'in_progress')" : status === 'closed' ? "WHERE status IN (N'resolved', N'rejected')" : '';
  const oWhere = status === 'open' ? "WHERE status = N'open'" : status === 'closed' ? "WHERE status <> N'open'" : '';
  const complaints = await many(`SELECT TOP 100 * FROM grievances ${gWhere} ORDER BY ${status === 'open' ? 'urgent DESC, due_at' : 'created_at DESC'}`);
  const orders = await many(`SELECT TOP 100 * FROM legal_orders ${oWhere} ORDER BY ${status === 'open' ? 'due_at' : 'created_at DESC'}`);
  const bans = await many(`SELECT TOP 200 id, username, display_name, reason, banned_at, expires_at, CASE WHEN face_embedding IS NULL THEN 0 ELSE 1 END AS has_face
    FROM banned_identities WHERE kind = N'ban' AND lifted_at IS NULL AND expires_at > SYSDATETIMEOFFSET() ORDER BY banned_at DESC`);
  const sum = await legalSummary();
  res.json({
    summary: Object.fromEntries(Object.entries(sum || {}).map(([k, v]) => [k, n(v)])),
    complaints: complaints.map(grievanceView), orders: orders.map(orderView), categories: CATEGORIES, orderHours: ORDER_HOURS,
    // bans: no phone or email here; the console shows only what's needed to recognise the ban
    bans: bans.map((b) => ({ id: b.id, username: b.username, name: b.display_name, reason: b.reason, bannedAt: b.banned_at, expiresAt: b.expires_at, face: !!b.has_face })),
  });
}));

r.patch('/legal/complaints/:id', requireConsole('support'), ah(async (req, res) => {
  const d = z.object({ status: z.enum(['in_progress', 'resolved', 'rejected']), resolution: z.string().trim().max(2000).optional(), removeContent: z.boolean().optional() })
    .refine((x) => !['resolved', 'rejected'].includes(x.status) || (x.resolution || '').length >= 10, { message: 'Write the decision for the person (at least 10 characters). It is emailed to them.' })
    .parse(req.body);
  const g = await one('SELECT * FROM grievances WHERE id=$1', [req.params.id]);
  if (!g) throw notFound('Complaint not found');
  const out = await updateGrievance(g, d, req);
  log(req, `Complaint #${g.ticket_no} → ${d.status}${out.removed ? ' (content removed)' : ''}`);
  res.json({ ok: true, ...out });
}));

const orderBody = z.object({
  source: z.enum(['court', 'government', 'police', 'cert_in', 'other']), authority: z.string().trim().min(3).max(200),
  orderRef: z.string().trim().max(120).optional(), orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(['takedown', 'info_request', 'preserve']), receivedAt: z.string().datetime({ offset: true }).optional(),
  contentUrls: z.array(z.string().trim().min(10).max(500)).max(50).optional(), targetUsername: z.string().trim().max(41).transform((v) => v.replace(/^@/, '')).optional(),
  summary: z.string().trim().min(10).max(2000), verified: z.boolean(),
});
r.post('/legal/orders', requireConsole('support'), ah(async (req, res) => {
  const d = orderBody.parse(req.body);
  if (!d.verified) throw badRequest('Check the order is genuine first (official email domain, signed order, or call back the office) and tick "Verified".', 'not_verified');
  const o = await addOrder(d, req);
  log(req, `Logged legal order L${o.ref_no} (${d.kind}) from ${d.authority}`);
  res.status(201).json({ ok: true, order: orderView(o) });
}));
r.post('/legal/orders/:id', requireConsole('support'), ah(async (req, res) => {
  const d = z.object({ action: z.enum(['remove', 'done', 'reject']), note: z.string().trim().max(2000).optional() })
    .refine((x) => x.action === 'remove' || (x.note || '').length >= 10, { message: 'Write what was done (or why it was refused), at least 10 characters.' })
    .parse(req.body);
  const o = await one('SELECT * FROM legal_orders WHERE id=$1', [req.params.id]);
  if (!o) throw notFound('Order not found');
  const out = await actOnOrder(o, d, req);
  log(req, `Legal order L${o.ref_no}: ${d.action}${out.removed ? ` (${out.removed} removed)` : ''}`);
  res.json({ ok: true, ...out });
}));

r.post('/legal/bans', OWNER, ah(async (req, res) => {
  const d = z.object({ username: z.string().trim().max(41).transform((v) => v.replace(/^@/, '')), reason: z.string().trim().min(10).max(500), days: z.number().int().min(30).max(BAN_DAYS * 2).optional(), confirm: z.literal(true) }).parse(req.body);
  const u = await one('SELECT * FROM users WHERE username=$1', [d.username]);
  if (!u) throw notFound('No account with that username');
  await banAccount(u, { reason: `${d.reason} (console: ${req.cu.name})`, days: d.days || BAN_DAYS }, req);
  log(req, `Banned @${u.username}`);
  res.json({ ok: true });
}));
r.post('/legal/bans/:id/lift', OWNER, ah(async (req, res) => {
  const d = z.object({ reason: z.string().trim().min(10).max(500) }).parse(req.body);
  const b = await one(`SELECT id, username FROM banned_identities WHERE id=$1 AND kind=N'ban' AND lifted_at IS NULL`, [req.params.id]);
  if (!b) throw notFound('Ban not found or already lifted');
  await query('UPDATE banned_identities SET lifted_at=SYSDATETIMEOFFSET(), face_embedding=NULL WHERE id=$1', [b.id]);
  await audit(req, 'ban_lifted', { actorId: null, detail: `${b.id} @${b.username} by ${req.cu.name}: ${d.reason}` });
  log(req, `Lifted the ban on @${b.username}`);
  res.json({ ok: true });
}));

// ---------- revenue ----------
r.get('/revenue', requireConsole('viewer'), ah(async (req, res) => {
  const ads = await many(`SELECT FORMAT(paid_on, 'yyyy-MM') AS m, SUM(amount) AS v FROM ad_payments GROUP BY FORMAT(paid_on, 'yyyy-MM')`);
  const msgs = await many(`SELECT FORMAT(SWITCHOFFSET(created_at, '+05:30'), 'yyyy-MM') AS m, SUM(amount_paise) / 100 AS v FROM paid_messages WHERE status = N'paid' GROUP BY FORMAT(SWITCHOFFSET(created_at, '+05:30'), 'yyyy-MM')`).catch(() => []);
  const boosts = await many(`SELECT FORMAT(SWITCHOFFSET(created_at, '+05:30'), 'yyyy-MM') AS m, SUM(amount_paise) / 100 AS v FROM spark_spreads WHERE status <> N'test' GROUP BY FORMAT(SWITCHOFFSET(created_at, '+05:30'), 'yyyy-MM')`).catch(() => []);
  const prem = await one('SELECT COUNT(*) AS n FROM users WHERE is_premium = 1');
  res.json({ ads, paidMessages: msgs, boosts, premiumUsers: n(prem?.n) });
}));

// ---------- ads: rate card, customers, hourly bookings, payments ----------
async function rateCard() { const s = await one(`SELECT value FROM console_settings WHERE [key] = N'rate_card'`); return JSON.parse(s?.value || '{}'); }
function price(card, { placement, cities, hours, days }) {
  const rate = n(card.rates?.[placement]); const mult = cities.reduce((s, c) => s + (card.cities?.[c] ?? 1), 0);
  const peak = hours.filter((h) => (card.peakHours || []).includes(h)).length;
  const hoursTotal = hours.length * days;
  const subtotal = Math.round(hoursTotal * rate * mult + peak * days * rate * mult * n(card.peakExtra));
  const gst = Math.round(subtotal * n(card.gst));
  return { rate, mult, hoursTotal, subtotal, gst, total: subtotal + gst };
}
r.get('/ads/settings', requireConsole('ads', 'viewer'), ah(async (req, res) => res.json({ card: await rateCard() })));
r.put('/ads/settings', OWNER, ah(async (req, res) => {
  const d = z.object({ rates: z.record(z.string(), z.number().int().min(0)), peakHours: z.array(z.number().int().min(0).max(23)), peakExtra: z.number().min(0).max(3), gst: z.number().min(0).max(0.5), cities: z.record(z.string(), z.number().min(0.1).max(5)) }).parse(req.body);
  await query(`UPDATE console_settings SET value=$1, updated_at=SYSDATETIMEOFFSET() WHERE [key] = N'rate_card'`, [JSON.stringify(d)]);
  log(req, 'Changed the ad rate card'); res.json({ ok: true });
}));
r.post('/ads/quote', requireConsole('ads'), ah(async (req, res) => {
  const d = z.object({ placement: z.enum(['feed', 'sparks']), cities: z.array(z.string()).min(1), hours: z.array(z.number().int().min(0).max(23)).min(1), days: z.number().int().min(1).max(90) }).parse(req.body);
  res.json(price(await rateCard(), d));
}));

const CUSTOMER_SUMMARY = `SELECT c.*,
    (SELECT COUNT(*) FROM ad_bookings b WHERE b.customer_id = c.id AND b.status <> N'cancelled') AS bookings,
    (SELECT ISNULL(SUM(hours_total), 0) FROM ad_bookings b WHERE b.customer_id = c.id AND b.status <> N'cancelled') AS hours,
    (SELECT ISNULL(SUM(total), 0) FROM ad_bookings b WHERE b.customer_id = c.id AND b.status <> N'cancelled') AS booked,
    (SELECT ISNULL(SUM(amount), 0) FROM ad_payments p WHERE p.customer_id = c.id) AS paid,
    (SELECT ISNULL(SUM(a.impressions), 0) FROM ad_bookings b JOIN ad_campaigns a ON a.id = b.campaign_id WHERE b.customer_id = c.id) AS views,
    (SELECT ISNULL(SUM(a.reach), 0) FROM ad_bookings b JOIN ad_campaigns a ON a.id = b.campaign_id WHERE b.customer_id = c.id) AS reach,
    (SELECT ISNULL(SUM(a.clicks), 0) FROM ad_bookings b JOIN ad_campaigns a ON a.id = b.campaign_id WHERE b.customer_id = c.id) AS clicks,
    (SELECT COUNT(*) FROM ad_bookings b JOIN ad_campaigns a ON a.id = b.campaign_id WHERE b.customer_id = c.id AND a.active = 1 AND a.starts_at <= SYSDATETIMEOFFSET() AND a.ends_at > SYSDATETIMEOFFSET()) AS live
  FROM ad_customers c`;
r.get('/ads/customers', requireConsole('ads', 'viewer'), ah(async (req, res) => {
  const rows = await many(`${CUSTOMER_SUMMARY} ORDER BY c.created_at DESC`);
  res.json({ customers: rows.map((c) => ({ ...c, due: Math.max(0, n(c.booked) - n(c.paid)) })) });
}));
const custBody = z.object({ name: z.string().trim().min(2).max(120), kind: z.string().max(60).optional(), contactName: z.string().max(80).optional(), phone: z.string().max(20).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')), gst: z.string().max(20).optional(), address: z.string().max(300).optional() });
r.post('/ads/customers', requireConsole('ads'), ah(async (req, res) => {
  const d = custBody.parse(req.body);
  const x = await one('INSERT INTO ad_customers (name, kind, contact_name, phone, email, gst, address) OUTPUT INSERTED.id VALUES ($1,$2,$3,$4,$5,$6,$7)', [d.name, d.kind || null, d.contactName || null, d.phone || null, d.email || null, d.gst || null, d.address || null]);
  log(req, `Added ad customer ${d.name}`); res.json({ id: x.id });
}));
r.patch('/ads/customers/:id', requireConsole('ads'), ah(async (req, res) => {
  const d = custBody.parse(req.body);
  await query('UPDATE ad_customers SET name=$2, kind=$3, contact_name=$4, phone=$5, email=$6, gst=$7, address=$8 WHERE id=$1', [req.params.id, d.name, d.kind || null, d.contactName || null, d.phone || null, d.email || null, d.gst || null, d.address || null]);
  log(req, `Edited ad customer ${d.name}`); res.json({ ok: true });
}));
r.get('/ads/customers/:id', requireConsole('ads', 'viewer'), ah(async (req, res) => {
  const c = await one(`${CUSTOMER_SUMMARY} WHERE c.id = $1`, [req.params.id]);
  if (!c) throw notFound('Customer not found');
  const bookings = await many(`SELECT b.*, a.impressions, a.reach, a.clicks, a.active, a.starts_at, a.ends_at, a.headline, a.media_url, a.every_n,
      (SELECT ISNULL(SUM(amount), 0) FROM ad_payments p WHERE p.booking_id = b.id) AS paid
    FROM ad_bookings b LEFT JOIN ad_campaigns a ON a.id = b.campaign_id WHERE b.customer_id = $1 ORDER BY b.created_at DESC`, [req.params.id]);
  const ids = bookings.map((b) => b.campaign_id).filter(Boolean);
  const inList = ids.map((_, i) => `$${i + 1}`).join(',');
  const daily = ids.length ? await many(`SELECT ad_id, day, impressions, clicks FROM ad_daily WHERE ad_id IN (${inList}) ORDER BY day`, ids) : [];
  const who = ids.length ? await many(`SELECT ${GENDER_SQL} AS gender, ${AGE_SQL} AS age, ISNULL(NULLIF(LTRIM(RTRIM(u.city)), N''), N'Not said') AS city
    FROM ad_viewers v JOIN users u ON u.id = v.user_id WHERE v.ad_id IN (${inList})`, ids) : [];
  const groupOf = (k) => { const g = who.reduce((a, x) => { a[x[k]] = (a[x[k]] || 0) + 1; return a; }, {}); return small(Object.entries(g).map(([key, v]) => ({ key, n: v }))).sort((a, b) => b.n - a.n); };
  const payments = await many('SELECT * FROM ad_payments WHERE customer_id = $1 ORDER BY paid_on DESC, created_at DESC', [req.params.id]);
  res.json({ customer: { ...c, due: Math.max(0, n(c.booked) - n(c.paid)) }, bookings: bookings.map((b) => ({ ...b, hours: b.hours.split(',').filter(Boolean).map(Number), cities: b.cities.split(',').filter(Boolean) })),
    daily, viewers: { gender: groupOf('gender'), age: groupOf('age'), city: groupOf('city'), total: who.length }, payments });
}));

const IST_MIDNIGHT = (date) => `${date}T00:00:00+05:30`;
r.post('/ads/bookings', requireConsole('ads'), uploadMemory('image', 8).single('image'), ah(async (req, res) => {
  const b = req.body || {};
  const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  const d = z.object({ customerId: z.string().regex(/^[0-9a-fA-F-]{36}$/), name: z.string().trim().min(2).max(120), placement: z.enum(['feed', 'sparks']),
    cities: z.array(z.string().max(60)).min(1).max(30), hours: z.array(z.coerce.number().int().min(0).max(23)).min(1).max(24),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.coerce.number().int().min(1).max(90),
    brand: z.string().trim().min(1).max(80), headline: z.string().trim().min(2).max(120), body: z.string().max(400).optional(),
    ctaLabel: z.string().max(30).optional(), ctaUrl: z.string().url().max(400).optional().or(z.literal('')),
    // how often it shows: after every N posts (Home) or Sparks
    every: z.coerce.number({ error: 'Choose how often the ad shows' }).int('Use a whole number of posts').min(2, 'Show the ad after at least 2 posts').max(50, 'Show the ad at least once every 50 posts') })
    .parse({ ...b, cities: list(b.cities), hours: list(b.hours), every: b.every === undefined || b.every === '' ? 5 : b.every });
  const cust = await one('SELECT id, name FROM ad_customers WHERE id=$1', [d.customerId]);
  if (!cust) throw notFound('Customer not found');
  const hours = [...new Set(d.hours)].sort((x, y) => x - y);
  const p = price(await rateCard(), { ...d, hours });
  const media = req.file ? await saveFile(req.file, 'ads', 'image') : null;
  const start = new Date(IST_MIDNIGHT(d.startDate)); const end = new Date(start.getTime() + d.days * 86400_000);
  const ad = await one(`INSERT INTO ad_campaigns (placement, brand, headline, body, media_url, media_kind, cta_label, cta_url, starts_at, ends_at, active, hours_csv, cities_csv, every_n)
    OUTPUT INSERTED.id VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13)`,
    [d.placement, d.brand, d.headline, d.body || null, media?.url || media || null, media ? 'image' : null, d.ctaLabel || null, d.ctaUrl || null, start, end,
      `,${hours.join(',')},`, `,${d.cities.map((c) => c.toLowerCase()).join(',')},`, d.every]);
  const bk = await one(`INSERT INTO ad_bookings (customer_id, campaign_id, name, placement, cities, start_date, days, hours, hours_total, rate, subtotal, gst, total, created_by)
    OUTPUT INSERTED.id, INSERTED.invoice_no VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [d.customerId, ad.id, d.name, d.placement, d.cities.join(','), d.startDate, d.days, hours.join(','), p.hoursTotal, p.rate, p.subtotal, p.gst, p.total, req.cu.name]);
  log(req, `Booked "${d.name}" for ${cust.name} (${p.hoursTotal} h, ₹${p.total}, every ${d.every} ${d.placement === 'sparks' ? 'Sparks' : 'posts'})`);
  res.json({ id: bk.id, invoiceNo: bk.invoice_no, ...p });
}));
// the ad goes live once the booking is fully paid
async function settle(bookingId) {
  const b = await one(`SELECT b.*, (SELECT ISNULL(SUM(amount), 0) FROM ad_payments p WHERE p.booking_id = b.id) AS paid FROM ad_bookings b WHERE b.id = $1`, [bookingId]);
  if (b && b.status === 'awaiting' && n(b.paid) >= n(b.total)) {
    await query(`UPDATE ad_bookings SET status = N'booked' WHERE id = $1`, [b.id]);
    if (b.campaign_id) await query('UPDATE ad_campaigns SET active = 1 WHERE id = $1', [b.campaign_id]);
    return true;
  }
  return false;
}
r.post('/ads/payments', requireConsole('ads'), ah(async (req, res) => {
  const d = z.object({ bookingId: z.string().regex(/^[0-9a-fA-F-]{36}$/), amount: z.coerce.number().int().min(1), method: z.enum(['UPI', 'Bank transfer', 'Cheque', 'Cash', 'Card']),
    reference: z.string().max(80).optional(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
  const b = await one('SELECT id, customer_id, name FROM ad_bookings WHERE id=$1', [d.bookingId]);
  if (!b) throw notFound('Booking not found');
  await query('INSERT INTO ad_payments (customer_id, booking_id, amount, method, reference, paid_on, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', [b.customer_id, b.id, d.amount, d.method, d.reference || null, d.paidOn, req.cu.name]);
  const live = await settle(b.id);
  log(req, `Recorded ₹${d.amount} (${d.method}) for "${b.name}"${live ? ' · ad is now live' : ''}`);
  res.json({ ok: true, live });
}));
// change how often a booked ad shows (takes effect the next time people open Home / Sparks)
r.put('/ads/bookings/:id/frequency', requireConsole('ads'), ah(async (req, res) => {
  const { every } = z.object({ every: z.coerce.number().int('Use a whole number of posts').min(2, 'Show the ad after at least 2 posts').max(50, 'Show the ad at least once every 50 posts') }).parse(req.body || {});
  const b = await one('SELECT id, name, campaign_id FROM ad_bookings WHERE id=$1', [req.params.id]);
  if (!b?.campaign_id) throw notFound('Booking not found');
  await query('UPDATE ad_campaigns SET every_n = $2 WHERE id = $1', [b.campaign_id, every]);
  log(req, `Set "${b.name}" to show after every ${every} posts`); res.json({ ok: true, every });
}));
r.post('/ads/bookings/:id/:action', requireConsole('ads'), ah(async (req, res) => {
  const action = z.enum(['pause', 'resume', 'cancel']).parse(req.params.action);
  const b = await one('SELECT * FROM ad_bookings WHERE id=$1', [req.params.id]);
  if (!b) throw notFound('Booking not found');
  if (action === 'cancel') { await query(`UPDATE ad_bookings SET status = N'cancelled' WHERE id=$1`, [b.id]); if (b.campaign_id) await query('UPDATE ad_campaigns SET active = 0 WHERE id=$1', [b.campaign_id]); }
  else if (b.campaign_id) {
    if (action === 'resume' && b.status !== 'booked') throw badRequest('This booking is not fully paid yet', 'not_paid');
    await query('UPDATE ad_campaigns SET active = $2 WHERE id=$1', [b.campaign_id, action === 'resume' ? 1 : 0]);
  }
  log(req, `${action[0].toUpperCase() + action.slice(1)}d "${b.name}"`); res.json({ ok: true });
}));

export default r;
