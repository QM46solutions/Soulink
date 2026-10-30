// Account deletion (DPDP Act right to erasure) and data download (right to access).
// Deleting removes the person and everything linked to them: face fingerprint, Soul DNA, posts, Sparks, comments,
// likes, chats they're in. Only the sign-up details (username, phone / email, dates) are kept for 180 days in
// deleted_accounts, as the IT Rules 2021 ask, then purged.
import fs from 'node:fs/promises';
import path from 'node:path';
import { many, one, query } from '../db.js';
import { config } from '../config.js';
import { signExport } from '../lib/exportSign.js';

// Identity record kept after erasure: 1 year rolling (DPDP Rules Rule 8(3); covers IT Rules' 180 days)
export const DELETED_KEEP_DAYS = 365;

export async function deleteAccount(userId, reason = 'user') {
  const u = await one('SELECT id, username, display_name, birth_date, city, phone, email, created_at, terms_version, terms_accepted_at, face_consent_at FROM users WHERE id=$1', [userId]);
  if (!u) return false;
  await query('UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, SYSDATETIMEOFFSET()) WHERE user_id=$1', [u.id]);
  await query(`INSERT INTO deleted_accounts (user_id, username, phone, email, created_at, display_name, birth_date, city, terms_version, terms_accepted_at, face_consent_at, reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [u.id, u.username, u.phone, u.email, u.created_at, u.display_name, u.birth_date, u.city, u.terms_version, u.terms_accepted_at, u.face_consent_at, reason]);
  await purgeUserFiles(u.id);
  // every column in the database that points at users(id)
  const fks = await many(`SELECT OBJECT_NAME(fkc.parent_object_id) AS tbl, c.name AS col, c.is_nullable AS nullable
    FROM sys.foreign_key_columns fkc
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.referenced_object_id = OBJECT_ID('users')`);
  // rows that depend on other rows (likes on a post, messages in a chat) clear over a few passes
  for (let pass = 0; pass < 8; pass += 1) {
    for (const f of fks) {
      try {
        if (f.nullable) await query(`UPDATE [${f.tbl}] SET [${f.col}] = NULL WHERE [${f.col}] = $1`, [u.id]);
        else await query(`DELETE FROM [${f.tbl}] WHERE [${f.col}] = $1`, [u.id]);
      } catch { /* a child row still points here: the next pass clears it */ }
    }
    try { await query('DELETE FROM users WHERE id=$1', [u.id]); return true; } catch (e) {
      if (pass === 7) throw e;
      await deleteChildren(u.id);
    }
  }
  return true;
}

// rows that point at this person's posts / Sparks / comments / chats (not at the user directly)
async function deleteChildren(id) {
  const parents = await many(`SELECT OBJECT_NAME(fkc.parent_object_id) AS tbl, c.name AS col
    FROM sys.foreign_key_columns fkc JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.referenced_object_id = OBJECT_ID('users')`);
  for (const p of parents) {
    const kids = await many(`SELECT OBJECT_NAME(fkc.parent_object_id) AS tbl, c.name AS col
      FROM sys.foreign_key_columns fkc JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      WHERE fkc.referenced_object_id = OBJECT_ID($1)`, [p.tbl]).catch(() => []);
    for (const k of kids) {
      await query(`DELETE FROM [${k.tbl}] WHERE [${k.col}] IN (SELECT id FROM [${p.tbl}] WHERE [${p.col}] = $1)`, [id]).catch(() => {});
    }
  }
}

export async function purgeDeletedAccounts() {
  await query(`DELETE FROM deleted_accounts WHERE deleted_at < DATEADD(DAY, -${DELETED_KEEP_DAYS}, SYSDATETIMEOFFSET())`).catch(() => {});
}

const safe = (p) => p.catch(() => []);
/** Everything Soulink holds about one person, as plain JSON (never other people's private data). */
export async function exportAccount(userId) {
  const user = await one('SELECT * FROM users WHERE id=$1', [userId]);
  if (!user) return null;
  const { lat, lon, ...profile } = user; // approximate location only
  const [posts, sparks, comments, sparkComments, connections, messages, soul] = await Promise.all([
    safe(many('SELECT id, caption, place, created_at FROM posts WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, category, caption, place, created_at FROM sparks WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, post_id, body, created_at FROM comments WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, spark_id, body, created_at FROM spark_comments WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many(`SELECT u.username, f.status, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id=$1`, [userId])),
    safe(many('SELECT TOP 2000 conversation_id, kind, body, created_at FROM messages WHERE sender_id=$1 ORDER BY created_at DESC', [userId])),
    safe(many('SELECT answers, completed_at FROM soul_dna WHERE user_id=$1', [userId])),
  ]);
  delete profile.password_hash;
  const soulDna = soul[0] ? { answers: typeof soul[0].answers === 'string' ? JSON.parse(soul[0].answers || '{}') : soul[0].answers, completedAt: soul[0].completed_at } : null;
  // signed, so "Restore my data" accepts only a genuine, unchanged Soulink download of this person
  return signExport({
    soulinkExport: 1,
    exportedAt: new Date().toISOString(),
    note: 'Your Soulink data. Keep this file: if you come back to Soulink, Settings › Restore my data brings back your profile and Soul DNA. Your face fingerprint is not included.',
    profile, soulDna, posts, sparks, comments, sparkComments, connectionsYouMade: connections, messagesYouSent: messages,
  });
}

/**
 * The person's photos, voice notes, Soulmojis, Sparks... : every '/uploads/...' file named in their own rows
 * (any column ending in "url", or called "url", in a table that points at them) is removed from the server's
 * disk and from the database copy (stored_files), so erasing an account really erases their pictures too.
 */
export async function purgeUserFiles(userId) {
  const cols = await many(`SELECT DISTINCT OBJECT_NAME(fkc.parent_object_id) AS tbl, uc.name AS col, c.name AS urlcol
    FROM sys.foreign_key_columns fkc
    JOIN sys.columns uc ON uc.object_id = fkc.parent_object_id AND uc.column_id = fkc.parent_column_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND (c.name LIKE '%[_]url' OR c.name = 'url')
    WHERE fkc.referenced_object_id = OBJECT_ID('users')`);
  const urls = new Set();
  const own = await one('SELECT * FROM users WHERE id=$1', [userId]);
  for (const [k, v] of Object.entries(own || {})) if (/_url$/.test(k) && typeof v === 'string') urls.add(v);
  for (const { tbl, col, urlcol } of cols) {
    const rows = await many(`SELECT [${urlcol}] AS u FROM [${tbl}] WHERE [${col}] = $1 AND [${urlcol}] LIKE '/uploads/%'`, [userId]).catch(() => []);
    for (const r of rows) urls.add(r.u);
  }
  let n = 0;
  for (const url of urls) {
    if (typeof url !== 'string' || !url.startsWith('/uploads/') || url.includes('..')) continue;
    await query('DELETE FROM stored_files WHERE path=$1', [url]).catch(() => {});
    await fs.rm(path.join(config.uploadDir, url.replace(/^\/uploads\//, '')), { force: true }).catch(() => {});
    n += 1;
  }
  return n;
}

