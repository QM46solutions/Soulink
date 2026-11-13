// Applies SQL files in ./migrations in order, once each. Run: npm run migrate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool, sql } from './db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function migrate({ log = true } = {}) {
  const pool = await getPool();
  await pool.request().batch(`
    IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
      CREATE TABLE dbo.schema_migrations (
        name NVARCHAR(200) NOT NULL PRIMARY KEY,
        applied_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );`);
  const done = new Set((await pool.request().query('SELECT name FROM dbo.schema_migrations')).recordset.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const batches = text.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const b of batches) await new sql.Request(transaction).batch(b);
      await new sql.Request(transaction).input('name', sql.NVarChar(200), file).query('INSERT INTO dbo.schema_migrations (name) VALUES (@name)');
      await transaction.commit();
      if (log) console.log(`✓ applied ${file}`);
    } catch (e) {
      try { await transaction.rollback(); } catch { /* ignore */ }
      throw new Error(`Migration ${file} failed: ${e.message}`);
    }
  }
  if (log) console.log('Database is up to date.');
}

/** Drops every Soulink table (used by the automated tests on the separate test database). */
export async function dropAll() {
  const pool = await getPool();
  await pool.request().batch(`
    DECLARE @sql NVARCHAR(MAX) = N'';
    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
                 + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
      FROM sys.foreign_keys;
    EXEC sp_executesql @sql;
    SET @sql = N'';
    SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
      FROM sys.tables WHERE is_ms_shipped = 0;
    EXEC sp_executesql @sql;`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => closePool())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
