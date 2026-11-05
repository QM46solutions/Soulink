// Deletes test accounts that have NOT finished Soul DNA (soul_ready = 0), and everything linked to them.
// Accounts with Soul DNA done are kept. Run with DELETE-UNFINISHED-ACCOUNTS.bat. Refuses in production.
// Usage: node tools/delete-unfinished.js          -> lists the accounts that would be deleted
//        node tools/delete-unfinished.js --yes    -> deletes them
import { config } from '../src/config.js';
import { many, query, closePool } from '../src/db.js';

import { guardScript } from './guard.js';
if (!config.isDev) { console.error('Refusing: this is a production server.'); process.exit(1); }
await guardScript('delete-unfinished', { neverInProduction: true });

const users = await many(`SELECT id, username, display_name, phone, email, face_verified, created_at
  FROM users WHERE soul_ready = 0 ORDER BY created_at`);
const kept = await many('SELECT username FROM users WHERE soul_ready = 1');
console.log(`Kept (Soul DNA done): ${kept.map((k) => '@' + (k.username || '?')).join(', ') || 'none'}`);
console.log(`Accounts WITHOUT Soul DNA: ${users.length}`);
for (const u of users) console.log(`  - @${u.username || '(no username)'}  ${u.display_name || ''}  ${u.phone || u.email || ''}  face=${u.face_verified ? 'yes' : 'no'}  created ${new Date(u.created_at).toLocaleString()}`);
if (!users.length || !process.argv.includes('--yes')) { await closePool(); process.exit(0); }

// Every column in the database that points at users(id)
const fks = await many(`SELECT OBJECT_NAME(fkc.parent_object_id) AS tbl, c.name AS col, c.is_nullable AS nullable
  FROM sys.foreign_key_columns fkc
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fkc.referenced_object_id = OBJECT_ID('users')`);

for (const u of users) {
  const ids = [u.id];
  // A few passes: rows that depend on other rows (likes on a post, messages in a chat) clear first
  for (let pass = 0; pass < 6; pass += 1) {
    let failed = 0;
    for (const f of fks) {
      try {
        if (f.nullable) await query(`UPDATE [${f.tbl}] SET [${f.col}] = NULL WHERE [${f.col}] = $1`, ids);
        else await query(`DELETE FROM [${f.tbl}] WHERE [${f.col}] = $1`, ids);
      } catch { failed += 1; }
    }
    try { await query('DELETE FROM users WHERE id = $1', ids); break; } catch (e) { if (pass === 5) throw e; }
    if (!failed) break;
  }
  if (u.phone || u.email) await query('DELETE FROM otp_codes WHERE target = $1', [u.phone || u.email]).catch(() => {});
  console.log(`  deleted @${u.username || '(no username)'} ${u.phone || u.email || ''}`);
}
await closePool();
console.log('Done. If that account was signed in, refresh the page (F5) to get back to the welcome screen.');
process.exit(0);
