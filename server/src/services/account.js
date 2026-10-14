// Account deletion (DPDP Act right to erasure) and data download (right to access).
// Deleting removes the person and everything linked to them: face fingerprint, Soul DNA, posts, Sparks, comments,
// likes, chats they're in. Only the sign-up details (username, phone / email, dates) are kept for 180 days in
// deleted_accounts, as the IT Rules 2021 ask, then purged.
import { many, one, query } from '../db.js';

export const DELETED_KEEP_DAYS = 180;

export async function deleteAccount(userId) {
  const u = await one('SELECT id, username, phone, email, created_at FROM users WHERE id=$1', [userId]);
  if (!u) return false;
  await query('UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, SYSDATETIMEOFFSET()) WHERE user_id=$1', [u.id]);
  await query('INSERT INTO deleted_accounts (user_id, username, phone, email, created_at) VALUES ($1, $2, $3, $4, $5)',
    [u.id, u.username, u.phone, u.email, u.created_at]);
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
  const [posts, sparks, comments, sparkComments, connections, messages] = await Promise.all([
    safe(many('SELECT id, caption, place, created_at FROM posts WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, category, caption, place, created_at FROM sparks WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, post_id, body, created_at FROM comments WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many('SELECT id, spark_id, body, created_at FROM spark_comments WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId])),
    safe(many(`SELECT u.username, f.status, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id=$1`, [userId])),
    safe(many('SELECT TOP 2000 conversation_id, kind, body, created_at FROM messages WHERE sender_id=$1 ORDER BY created_at DESC', [userId])),
  ]);
  delete profile.password_hash;
  return {
    exportedAt: new Date().toISOString(),
    note: 'Your Soulink data. Your face fingerprint is stored only as numbers used to verify you; it is not an image and is not included here.',
    profile, posts, sparks, comments, sparkComments, connectionsYouMade: connections, messagesYouSent: messages,
  };
}
