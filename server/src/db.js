// Microsoft SQL Server access layer.
// Queries are written with $1, $2 … placeholders; they are sent to SQL Server as @p1, @p2 … parameters.
// Results are normalised so the rest of the app gets plain JS values:
//   UNIQUEIDENTIFIER → lowercase string, DATE → 'YYYY-MM-DD', JSON columns → arrays/objects.
import sql from 'mssql';
import { config } from './config.js';

// Columns stored as JSON text in SQL Server, returned to the app as arrays/objects.
const JSON_COLUMNS = new Set(['interests', 'languages', 'discover_filters', 'media_urls', 'options', 'verdict', 'meta', 'embedding']);

let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    const db = config.db;
    poolPromise = new sql.ConnectionPool({
      server: db.server,
      port: db.port,
      database: db.database,
      user: db.user,
      password: db.password,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      options: {
        encrypt: db.encrypt,
        trustServerCertificate: db.trustServerCertificate,
        ...(db.instanceName && !db.port ? { instanceName: db.instanceName } : {}),
      },
    }).connect().catch((err) => {
      poolPromise = null;
      throw new Error(`Could not connect to SQL Server at ${db.server}:${db.port} (database "${db.database}"): ${err.message}`);
    });
  }
  return poolPromise;
}

export async function closePool() {
  if (poolPromise) {
    const p = await poolPromise.catch(() => null);
    poolPromise = null;
    if (p) await p.close();
  }
}

function bind(request, params = []) {
  params.forEach((v, i) => {
    const name = `p${i + 1}`;
    if (v === null || v === undefined) request.input(name, sql.NVarChar, null);
    else if (typeof v === 'boolean') request.input(name, sql.Bit, v);
    else if (typeof v === 'number') request.input(name, Number.isInteger(v) ? sql.Int : sql.Float, v);
    else if (v instanceof Date) request.input(name, sql.DateTimeOffset, v);
    else if (typeof v === 'object') request.input(name, sql.NVarChar(sql.MAX), JSON.stringify(v));
    else request.input(name, sql.NVarChar(sql.MAX), String(v));
  });
}

const toParams = (text) => text.replace(/\$(\d+)/g, '@p$1');

function normaliseRows(result) {
  const rows = result.recordset || [];
  const cols = rows.columns || result.recordset?.columns || {};
  const guidCols = [];
  const dateCols = [];
  for (const [name, meta] of Object.entries(cols)) {
    if (meta.type === sql.UniqueIdentifier) guidCols.push(name);
    if (meta.type === sql.Date) dateCols.push(name);
  }
  for (const row of rows) {
    for (const c of guidCols) if (typeof row[c] === 'string') row[c] = row[c].toLowerCase();
    for (const c of dateCols) if (row[c] instanceof Date) row[c] = row[c].toISOString().slice(0, 10);
    for (const c of Object.keys(row)) {
      if (JSON_COLUMNS.has(c) && typeof row[c] === 'string') {
        try { row[c] = JSON.parse(row[c]); } catch { /* leave as text */ }
      }
    }
  }
  return { rows, rowCount: result.rowsAffected?.reduce((a, b) => a + b, 0) ?? rows.length };
}

async function run(requestFactory, text, params) {
  const request = requestFactory();
  bind(request, params);
  const result = await request.query(toParams(text));
  return normaliseRows(result);
}

export async function query(text, params) {
  const pool = await getPool();
  return run(() => pool.request(), text, params);
}

export async function one(text, params) {
  const { rows } = await query(text, params);
  return rows[0] || null;
}

export async function many(text, params) {
  const { rows } = await query(text, params);
  return rows;
}

/** Run fn(client) inside a transaction. client.query(text, params) has the same shape as query(). */
export async function tx(fn) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const client = { query: (text, params) => run(() => new sql.Request(transaction), text, params) };
  try {
    const result = await fn(client);
    await transaction.commit();
    return result;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* already rolled back */ }
    throw err;
  }
}

export { sql };
