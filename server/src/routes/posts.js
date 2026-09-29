// Posts: photo posts (1-10 photos) or text-only posts, with likes and comments.
//  POST   /posts                     multipart: photos[] (optional), caption  → new post
//  GET    /posts/:id                 one post (same visibility as the profile)
//  DELETE /posts/:id                 delete my post
//  POST   /posts/:id/like            like / unlike (toggle)
//  GET    /posts/:id/comments        comments, oldest first
//  POST   /posts/:id/comments        { body }
//  DELETE /posts/:id/comments/:cid   delete my comment (or any comment on my post)
//  GET    /posts/user/:userId        someone's posts (profile grid)
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { canViewContent, isBlockedEither, notify, relationship, userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().uuid();
const media = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch { return []; } })());

const SELECT = `SELECT p.id AS post_id, p.author_id, p.caption, p.media_urls, p.created_at AS post_at,
    (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count,
    CASE WHEN EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = $1) THEN 1 ELSE 0 END AS liked,
    u.id, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
  FROM posts p JOIN users u ON u.id = p.author_id`;

export const postView = (x, meId) => ({
  id: x.post_id,
  caption: x.caption,
  media: media(x.media_urls),
  createdAt: x.post_at,
  likeCount: Number(x.like_count || 0),
  commentCount: Number(x.comment_count || 0),
  liked: !!x.liked,
  mine: String(x.author_id).toLowerCase() === String(meId).toLowerCase(),
  author: userCard(x),
});
export const POST_SELECT = SELECT;

async function loadVisible(req) {
  const id = uuid.parse(req.params.id);
  const x = await one(`${SELECT} WHERE p.id = $2 AND p.deleted_at IS NULL`, [req.user.id, id]);
  if (!x) throw notFound('Post not found');
  if (String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) {
    if (await isBlockedEither(req.user.id, x.author_id)) throw notFound('Post not found');
    const author = await one('SELECT * FROM users WHERE id=$1', [x.author_id]);
    if (!canViewContent(author, await relationship(req.user.id, author.id))) throw forbidden('This account is private', 'private_account');
  }
  return x;
}

r.post('/', uploadMemory('image', 10, 10).array('photos', 10), ah(async (req, res) => {
  const { caption } = z.object({ caption: z.string().max(2200).optional() }).parse(req.body || {});
  const files = req.files || [];
  if (!files.length && !caption?.trim()) throw badRequest('Add a photo or write something', 'empty_post');
  const urls = [];
  for (const f of files) urls.push(await saveFile(f, 'posts'));
  const p = await one('INSERT INTO posts (author_id, caption, media_urls) OUTPUT INSERTED.id VALUES ($1, $2, $3)', [req.user.id, (caption || '').trim(), urls]);
  const x = await one(`${SELECT} WHERE p.id = $2`, [req.user.id, p.id]);
  res.status(201).json({ post: postView(x, req.user.id) });
}));

r.get('/user/:userId', ah(async (req, res) => {
  const author = await one('SELECT * FROM users WHERE id=$1', [uuid.parse(req.params.userId)]);
  if (!author) throw notFound('User not found');
  if (await isBlockedEither(req.user.id, author.id)) throw notFound('User not found');
  if (!canViewContent(author, await relationship(req.user.id, author.id))) return res.json({ posts: [], private: true });
  const rows = await many(`${SELECT} WHERE p.author_id = $2 AND p.deleted_at IS NULL AND p.is_anonymous = 0 ORDER BY p.created_at DESC`, [req.user.id, author.id]);
  res.json({ posts: rows.map((x) => postView(x, req.user.id)) });
}));

r.get('/:id', ah(async (req, res) => {
  res.json({ post: postView(await loadVisible(req), req.user.id) });
}));

r.delete('/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const upd = await one('UPDATE posts SET deleted_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!upd) throw notFound('Post not found');
  res.json({ ok: true });
}));

r.post('/:id/like', ah(async (req, res) => {
  const x = await loadVisible(req);
  const had = await one('SELECT 1 AS y FROM post_likes WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  if (had) await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  else {
    await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [x.post_id, req.user.id]);
    await notify(x.author_id, req.user.id, 'post_like', x.post_id).catch(() => {});
  }
  const n = await one('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [x.post_id]);
  res.json({ liked: !had, likeCount: Number(n.n) });
}));

r.get('/:id/comments', ah(async (req, res) => {
  const x = await loadVisible(req);
  const rows = await many(
    `SELECT c.id AS comment_id, c.body, c.created_at AS comment_at, c.author_id, u.* FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at`, [x.post_id],
  );
  const postMine = String(x.author_id).toLowerCase() === String(req.user.id).toLowerCase();
  res.json({
    comments: rows.map((c) => ({
      id: c.comment_id, body: c.body, createdAt: c.comment_at, author: userCard(c),
      canDelete: postMine || String(c.author_id).toLowerCase() === String(req.user.id).toLowerCase(),
    })),
  });
}));

r.post('/:id/comments', ah(async (req, res) => {
  const x = await loadVisible(req);
  const { body } = z.object({ body: z.string().trim().min(1).max(2200) }).parse(req.body);
  const c = await one('INSERT INTO comments (post_id, author_id, body) OUTPUT INSERTED.* VALUES ($1, $2, $3)', [x.post_id, req.user.id, body]);
  await notify(x.author_id, req.user.id, 'post_comment', x.post_id, { preview: body.slice(0, 80) }).catch(() => {});
  res.status(201).json({ comment: { id: c.id, body: c.body, createdAt: c.created_at, author: userCard(req.user), canDelete: true } });
}));

r.delete('/:id/comments/:cid', ah(async (req, res) => {
  const x = await loadVisible(req);
  const cid = uuid.parse(req.params.cid);
  const postMine = String(x.author_id).toLowerCase() === String(req.user.id).toLowerCase();
  const upd = await one(
    `UPDATE comments SET deleted_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL ${postMine ? '' : 'AND author_id=$3'}`,
    postMine ? [cid, x.post_id] : [cid, x.post_id, req.user.id],
  );
  if (!upd) throw notFound('Comment not found');
  res.json({ ok: true });
}));

export default r;
