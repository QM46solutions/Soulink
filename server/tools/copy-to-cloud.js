// Copies everything from the Soulink database on this laptop (accounts, posts, chats, Soul DNA...)
// and every uploaded photo / voice note into the cloud database. The cloud copy is REPLACED.
// Run it with COPY-DATA-TO-CLOUD.bat. Cloud settings come from server\cloud.env (SETUP-CLOUD.bat writes it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const local = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
const cloudFile = path.join(root, 'cloud.env');
if (!fs.existsSync(cloudFile)) { console.error('\n  No cloud settings yet. Run SETUP-CLOUD.bat first.\n'); process.exit(1); }
const cloud = dotenv.parse(fs.readFileSync(cloudFile));

// Production guard (Information Security Policy, section 4): the cloud database is the LIVE one, with real
// people's accounts. Replacing it needs a written reason, which is kept in the cloud's audit_log.
const ri = process.argv.indexOf('--production-reason');
const reason = ri > 0 ? String(process.argv[ri + 1] || '').trim() : '';
if (reason.length < 10) {
  console.error('\n  Refusing: this would REPLACE the live cloud database with the data on this laptop.');
  console.error('  If this is really needed, run COPY-DATA-TO-CLOUD.bat again and give the reason (at least 10 characters).');
  console.error('  Tip: Azure keeps 7 days of restore points (Azure portal > SQL database > Restore) in case it goes wrong.\n');
  process.exit(1);
}
// Records the law or our policy says we must keep are never replaced from the laptop: the cloud's own copy stays.
const KEEP = new Set(['audit_log', 'deleted_accounts', 'banned_identities', 'copyright_reports', 'copyright_strikes', 'app_secrets']);
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const cfg = (e, encryptDefault) => ({
  server: e.DB_SERVER || 'localhost', port: Number(e.DB_PORT || 1433), database: e.DB_NAME, user: e.DB_USER, password: e.DB_PASSWORD,
  requestTimeout: 120000, connectionTimeout: 60000,
  options: { encrypt: bool(e.DB_ENCRYPT, encryptDefault), trustServerCertificate: bool(e.DB_TRUST_SERVER_CERT, !encryptDefault) },
});

// 1. make sure the cloud database has all the tables (same migrations the server runs)
for (const k of ['DB_SERVER', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_ENCRYPT', 'DB_TRUST_SERVER_CERT']) process.env[k] = cloud[k] ?? process.env[k];
process.env.DB_ENCRYPT ??= 'true'; process.env.DB_TRUST_SERVER_CERT ??= 'false';
console.log(`\n  Cloud database: ${cloud.DB_SERVER} / ${cloud.DB_NAME}`);
const { migrate } = await import('../src/migrate.js');
const { waitForDatabase, closePool } = await import('../src/db.js');
console.log('  Connecting (a sleeping cloud database can take a minute to wake up)...');
await waitForDatabase({ log: false, maxMs: 180000 });
await migrate({ log: false });
await closePool();

const src = await new sql.ConnectionPool(cfg(local, false)).connect();
const dst = await new sql.ConnectionPool(cfg(cloud, true)).connect();
const tablesOf = async (p) => (await p.request().query(`SELECT t.name FROM sys.tables t WHERE t.is_ms_shipped = 0 AND t.name NOT IN ('schema_migrations', 'stored_files')`)).recordset.map((r) => r.name);
const srcTables = new Set(await tablesOf(src));
const tables = (await tablesOf(dst)).filter((t) => srcTables.has(t) && !KEEP.has(t));
const live = (await dst.request().query('SELECT COUNT(*) AS n FROM users')).recordset[0].n;
console.log(`  The cloud has ${live} accounts now; they will be replaced by this laptop's. Kept as they are: ${[...KEEP].join(', ')}.`);
await dst.request().input('d', sql.NVarChar(1000), reason.slice(0, 1000))
  .query("INSERT INTO audit_log (actor_id, action, detail) VALUES (NULL, 'script:copy-to-cloud', @d)");
console.log(`  Logged in the cloud audit_log: copy-to-cloud — ${reason}`);

console.log(`  Copying ${tables.length} tables...`);
for (const t of tables) await dst.request().query(`ALTER TABLE [${t}] NOCHECK CONSTRAINT ALL`);
for (const t of tables) await dst.request().query(`DELETE FROM [${t}]`);

const typeOf = (m) => {
  const T = m.type;
  if ([sql.NVarChar, sql.VarChar, sql.VarBinary, sql.NChar, sql.Char, sql.Binary].includes(T)) return T(m.length === -1 || m.length > 8000 ? sql.MAX : m.length);
  if (T === sql.Decimal || T === sql.Numeric) return T(m.precision, m.scale);
  if (T === sql.DateTimeOffset || T === sql.DateTime2 || T === sql.Time) return T(m.scale);
  return T;
};
let total = 0;
for (const t of tables) {
  const cols = (await dst.request().input('t', t).query(`
    SELECT c.name, c.is_identity FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
     WHERE c.object_id = OBJECT_ID(@t) AND c.is_computed = 0 AND ty.name NOT IN ('timestamp', 'rowversion')`)).recordset;
  const srcCols = new Set((await src.request().input('t', t).query('SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@t)')).recordset.map((r) => r.name));
  const use = cols.filter((c) => srcCols.has(c.name));
  if (!use.length) continue;
  const names = use.map((c) => `[${c.name}]`).join(', ');
  const res = await src.request().query(`SELECT ${names} FROM [${t}]`);
  const rows = res.recordset; const meta = res.recordset.columns;
  const identity = use.some((c) => c.is_identity);
  const per = Math.max(1, Math.min(200, Math.floor(2000 / use.length)));
  for (let i = 0; i < rows.length; i += per) {
    const part = rows.slice(i, i + per);
    const rq = dst.request();
    const values = part.map((row, ri) => `(${use.map((c, ci) => {
      const n = `p${ri}_${ci}`;
      rq.input(n, typeOf(meta[c.name]), row[c.name]);
      return `@${n}`;
    }).join(', ')})`).join(', ');
    const ins = `INSERT INTO [${t}] (${names}) VALUES ${values}`;
    await rq.query(identity ? `SET IDENTITY_INSERT [${t}] ON; ${ins}; SET IDENTITY_INSERT [${t}] OFF;` : ins);
  }
  total += rows.length;
  if (rows.length) console.log(`   ${t}: ${rows.length}`);
}
for (const t of tables) await dst.request().query(`ALTER TABLE [${t}] CHECK CONSTRAINT ALL`);

// 2. photos and voice notes
const upDir = path.join(root, 'uploads');
let files = 0;
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.3gp': 'audio/3gpp', '.wav': 'audio/wav' };
for (const f of walk(upDir)) {
  const ext = path.extname(f).toLowerCase();
  if (!MIME[ext]) continue;
  const url = `/uploads/${path.relative(upDir, f).split(path.sep).join('/')}`;
  await dst.request().input('p', sql.NVarChar(400), url).input('m', sql.NVarChar(100), MIME[ext]).input('d', sql.VarBinary(sql.MAX), fs.readFileSync(f))
    .query('IF NOT EXISTS (SELECT 1 FROM stored_files WHERE path=@p) INSERT INTO stored_files (path, mime, data) VALUES (@p, @m, @d)');
  files += 1;
}
await src.close(); await dst.close();
console.log(`\n  Done: ${total} rows and ${files} photos / voice notes are now in the cloud.\n`);
process.exit(0);
