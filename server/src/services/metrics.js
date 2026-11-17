// Light health numbers for the team console: request times, errors, memory and CPU (every 5 minutes),
// and how many different people used the app in each hour (Indian time). Kept in memory, written in small batches.
import { query } from '../db.js';

const IST = 330 * 60_000;
let times = []; let errors = 0; const slow = new Map();
let cpuPrev = process.cpuUsage(); let cpuAt = Date.now();
const hourSets = new Map(); // "2026-11-17|21" -> Set(userId)
const daySets = new Map();  // "2026-11-17" -> Set(userId)

/** Express middleware: time every request. */
export function timeRequests(req, res, next) {
  const t = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    if (times.length < 50_000) times.push(ms);
    if (res.statusCode >= 500) errors += 1;
    const key = `${req.method} ${(req.baseUrl || '') + (req.route?.path || '')}`.trim();
    if (req.route) { const s = slow.get(key) || { n: 0, total: 0 }; s.n += 1; s.total += ms; slow.set(key, s); }
  });
  next();
}

const istParts = (d = new Date()) => { const x = new Date(d.getTime() + IST); return { day: x.toISOString().slice(0, 10), hour: x.getUTCHours() }; };

/** Called on every signed-in request (cheap). */
export function markUserActive(userId) {
  const { day, hour } = istParts();
  const k = `${day}|${hour}`;
  if (!hourSets.has(k)) hourSets.set(k, new Set());
  const id = String(userId).toLowerCase();
  hourSets.get(k).add(id);
  if (!daySets.has(day)) daySets.set(day, new Set());
  daySets.get(day).add(id);
}

const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);

export async function flushMetrics() {
  // people per hour (keeps the highest count seen for that hour)
  for (const [k, set] of hourSets) {
    const [day, hour] = k.split('|');
    await query(`MERGE activity_hourly AS t USING (SELECT CAST($1 AS DATE) AS day, CAST($2 AS TINYINT) AS hour) AS s ON t.day = s.day AND t.hour = s.hour
      WHEN MATCHED AND t.users < $3 THEN UPDATE SET users = $3
      WHEN NOT MATCHED THEN INSERT (day, hour, users) VALUES (s.day, s.hour, $3);`, [day, Number(hour), set.size]).catch(() => {});
  }
  for (const [day, set] of daySets) {
    await query(`MERGE activity_daily AS t USING (SELECT CAST($1 AS DATE) AS day) AS s ON t.day = s.day
      WHEN MATCHED AND t.users < $2 THEN UPDATE SET users = $2
      WHEN NOT MATCHED THEN INSERT (day, users) VALUES (s.day, $2);`, [day, set.size]).catch(() => {});
  }
  const now = istParts();
  for (const d of [...daySets.keys()]) if (d !== now.day) daySets.delete(d);
  for (const k of [...hourSets.keys()]) if (k !== `${now.day}|${now.hour}`) hourSets.delete(k);
  // server health
  if (!times.length) return;
  const sorted = times.sort((a, b) => a - b);
  const cpu = process.cpuUsage(cpuPrev); const wall = (Date.now() - cpuAt) * 1000;
  const cpuPct = Math.min(100, Math.round(((cpu.user + cpu.system) / Math.max(1, wall)) * 100));
  const top = [...slow.entries()].map(([k, s]) => [k, Math.round(s.total / s.n), s.n]).filter((x) => x[2] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const at = new Date(Math.floor(Date.now() / 300_000) * 300_000);
  const row = [at, sorted.length, errors, Math.round(pct(sorted, 0.5)), Math.round(pct(sorted, 0.95)), Math.round(sorted[sorted.length - 1]),
    Math.round(process.memoryUsage().rss / 1048576), cpuPct, JSON.stringify(top).slice(0, 400)];
  times = []; errors = 0; slow.clear(); cpuPrev = process.cpuUsage(); cpuAt = Date.now();
  await query(`IF NOT EXISTS (SELECT 1 FROM server_metrics WHERE at = $1)
    INSERT INTO server_metrics (at, requests, errors, p50_ms, p95_ms, max_ms, rss_mb, cpu_pct, slowest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, row).catch(() => {});
}

/** This hour's and today's distinct active people (Indian time), straight from memory: no database wait. */
export function liveActivity() {
  const { day, hour } = istParts();
  return { activeHour: hourSets.get(`${day}|${hour}`)?.size || 0, activeToday: daySets.get(day)?.size || 0, requestsSinceFlush: times.length };
}

let timer = null;
export function startMetrics() {
  if (timer) return;
  timer = setInterval(() => { flushMetrics().catch(() => {}); }, 5 * 60_000);
  timer.unref?.();
  // Render restarts and sleeps the server (new version, free-plan sleep): save the numbers first, not lose up to 5 minutes
  let saving = false;
  const saveAndExit = (sig) => {
    if (saving) return; saving = true;
    Promise.race([flushMetrics().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]).finally(() => process.exit(sig === 'SIGINT' ? 130 : 0));
  };
  process.once('SIGTERM', () => saveAndExit('SIGTERM'));
  process.once('SIGINT', () => saveAndExit('SIGINT'));
}
