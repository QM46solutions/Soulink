// Sparks ⚡: short talent videos (up to 60 s) in 5 categories, each with its own extras.
//  GET    /sparks?category=&before=   the Sparks tab (everyone's, newest first; filter by category)
//  GET    /sparks/user/:userId        someone's Sparks
//  POST   /sparks                     multipart: video (required), music? + category, caption, place?, details (json), oneTake=1|0
//  POST   /sparks/:id/react           the category reaction (🌍 ✈️ / 😋 / 👏 / 😂 / 🔥), toggle
//  POST   /sparks/:id/tried           cooking: "I tried it", toggle
//  POST   /sparks/:id/view            counts a view (once a day per person)
//  DELETE /sparks/:id                 delete my Spark
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { notify, userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
export const SPARK_CATEGORIES = ['travel', 'cooking', 'acting', 'comedy', 'music'];

// what each category may carry in "details"
const DETAILS = {
  travel: z.object({ sound: z.enum(['music', 'place', 'none']).optional() }),
  cooking: z.object({
    dish: z.string().trim().max(80).optional(),
    minutes: z.number().int().min(1).max(600).optional(),
    diet: z.enum(['veg', 'nonveg', 'egg', 'vegan']).optional(),
    ingredients: z.array(z.string().trim().min(1).max(80)).max(25).optional(),
    steps: z.array(z.string().trim().min(1).max(200)).max(15).optional(),
  }),
  acting: z.object({
    mode: z.enum(['dice', 'script', 'scene', 'dub']).optional(),
    prompt: z.object({ emotion: z.string().max(40), situation: z.string().max(120), character: z.string().max(60) }).partial().optional(),
    scriptTitle: z.string().trim().max(80).optional(),
    scene: z.string().trim().max(120).optional(), // "Recreating: …" (movie scene / dialogue they performed)
  }),
  comedy: z.object({ promptOfDay: z.string().trim().max(160).optional(), style: z.enum(['standup', 'skit', 'meme', 'roast', 'mimicry']).optional() }),
  music: z.object({ songCredit: z.string().trim().max(120).optional(), kind: z.enum(['original', 'cover']).optional(), style: z.enum(['singing', 'dance', 'instrument', 'beatbox', 'rap']).optional() }),
};

const SELECT = `SELECT s.*,
    (SELECT COUNT(*) FROM spark_reactions x WHERE x.spark_id = s.id) AS reactions,
    (SELECT COUNT(*) FROM spark_tried t WHERE t.spark_id = s.id) AS tried,
    (SELECT COUNT(*) FROM spark_views v WHERE v.spark_id = s.id) AS views,
    CASE WHEN EXISTS (SELECT 1 FROM spark_reactions x WHERE x.spark_id = s.id AND x.user_id = $1) THEN 1 ELSE 0 END AS reacted,
    CASE WHEN EXISTS (SELECT 1 FROM spark_tried t WHERE t.spark_id = s.id AND t.user_id = $1) THEN 1 ELSE 0 END AS i_tried,
    u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
  FROM sparks s JOIN users u ON u.id = s.author_id`;
// Sparks are a public stage, except from private accounts (only their Connections / Followers see those) and blocked people
const VISIBLE = `s.deleted_at IS NULL
  AND (u.is_private = 0 OR s.author_id = $1 OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = s.author_id AND f.status = N'accepted'))
  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = s.author_id) OR (b.blocker_id = s.author_id AND b.blocked_id = $1))`;

const parse = (v) => { try { return JSON.parse(v || 'null'); } catch { return null; } };
const view = (x, me) => ({
  id: x.id, category: x.category, videoUrl: x.video_url, caption: x.caption, place: x.place || null,
  music: x.music_url ? { url: x.music_url, title: x.music_title || 'Music' } : null,
  details: parse(x.details) || {}, oneTake: x.one_take === true || x.one_take === 1, createdAt: x.created_at,
  reactions: Number(x.reactions || 0), tried: Number(x.tried || 0), views: Number(x.views || 0),
  reacted: !!x.reacted, iTried: !!x.i_tried,
  mine: String(x.author_id).toLowerCase() === String(me).toLowerCase(),
  author: userCard({ ...x, id: x.uid }),
});

r.get('/', ah(async (req, res) => {
  const category = z.enum(SPARK_CATEGORIES).optional().parse(req.query.category || undefined);
  const before = req.query.before ? z.string().datetime({ offset: true }).parse(req.query.before) : null;
  const rows = await many(
    `${SELECT} WHERE ${VISIBLE} AND ($2 IS NULL OR s.category = $2) AND ($3 IS NULL OR s.created_at < CAST($3 AS DATETIMEOFFSET))
      ORDER BY s.created_at DESC OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY`, [req.user.id, category || null, before]);
  res.json({ sparks: rows.map((x) => view(x, req.user.id)), hasMore: rows.length === 20 });
}));

r.get('/user/:userId', ah(async (req, res) => {
  const id = uuid.parse(req.params.userId);
  const rows = await many(`${SELECT} WHERE ${VISIBLE} AND s.author_id = $2 ORDER BY s.created_at DESC`, [req.user.id, id]);
  res.json({ sparks: rows.map((x) => view(x, req.user.id)) });
}));

r.post('/', requireSoul, uploadMemory('spark', 40, 2).fields([{ name: 'video', maxCount: 1 }, { name: 'music', maxCount: 1 }]), ah(async (req, res) => {
  const video = req.files?.video?.[0]; const music = req.files?.music?.[0];
  if (!video || !video.mimetype.startsWith('video/')) throw badRequest('Add a video first (up to 60 seconds)', 'no_video');
  if (music && !music.mimetype.startsWith('audio/')) throw badRequest('Music must be an audio file');
  const b = z.object({
    category: z.enum(SPARK_CATEGORIES),
    caption: z.string().trim().max(1000).default(''),
    place: z.string().trim().max(150).optional(),
    musicTitle: z.string().trim().max(150).optional(),
    details: z.string().optional(),
    oneTake: z.enum(['0', '1']).default('0'),
  }).parse(req.body || {});
  let details = {};
  try { details = b.details ? DETAILS[b.category].parse(JSON.parse(b.details)) : {}; } catch { throw badRequest('Some of the extra details are not right'); }
  if (b.category === 'travel' && !b.place) throw badRequest('Add the place for a travel Spark', 'no_place');
  const videoUrl = await saveFile(video, 'sparks', 'spark');
  const musicUrl = music ? await saveFile(music, 'sparks', 'spark') : null;
  const x = await one(
    `INSERT INTO sparks (author_id, category, video_url, music_url, music_title, caption, place, details, one_take)
     OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [req.user.id, b.category, videoUrl, musicUrl, musicUrl ? (b.musicTitle || music.originalname?.replace(/\.[a-z0-9]{2,4}$/i, '') || 'Music') : null, b.caption, b.place || null, JSON.stringify(details), b.oneTake === '1'],
  );
  const row = await one(`${SELECT} WHERE s.id = $2`, [req.user.id, x.id]);
  res.status(201).json({ spark: view(row, req.user.id) });
}));

async function visible(req) {
  const id = uuid.parse(req.params.id);
  const x = await one(`${SELECT} WHERE ${VISIBLE} AND s.id = $2`, [req.user.id, id]);
  if (!x) throw notFound('Spark not found');
  return x;
}

r.post('/:id/react', ah(async (req, res) => {
  const x = await visible(req);
  if (x.reacted) await query('DELETE FROM spark_reactions WHERE spark_id=$1 AND user_id=$2', [x.id, req.user.id]);
  else {
    await query('INSERT INTO spark_reactions (spark_id, user_id) VALUES ($1, $2)', [x.id, req.user.id]);
    await notify(x.author_id, req.user.id, 'spark_reaction', x.id, { category: x.category }).catch(() => {});
  }
  const n = await one('SELECT COUNT(*) AS n FROM spark_reactions WHERE spark_id=$1', [x.id]);
  res.json({ reacted: !x.reacted, reactions: Number(n.n) });
}));

r.post('/:id/tried', ah(async (req, res) => {
  const x = await visible(req);
  if (x.category !== 'cooking') throw badRequest('"I tried it" is for cooking Sparks');
  if (x.i_tried) await query('DELETE FROM spark_tried WHERE spark_id=$1 AND user_id=$2', [x.id, req.user.id]);
  else {
    await query('INSERT INTO spark_tried (spark_id, user_id) VALUES ($1, $2)', [x.id, req.user.id]);
    await notify(x.author_id, req.user.id, 'spark_tried', x.id, { dish: parse(x.details)?.dish || null }).catch(() => {});
  }
  const n = await one('SELECT COUNT(*) AS n FROM spark_tried WHERE spark_id=$1', [x.id]);
  res.json({ iTried: !x.i_tried, tried: Number(n.n) });
}));

r.post('/:id/view', ah(async (req, res) => {
  const x = await visible(req);
  if (String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) {
    await query('IF NOT EXISTS (SELECT 1 FROM spark_views WHERE spark_id=$1 AND viewer_id=$2 AND day=CAST(SYSDATETIMEOFFSET() AS DATE)) INSERT INTO spark_views (spark_id, viewer_id, day) VALUES ($1, $2, CAST(SYSDATETIMEOFFSET() AS DATE))', [x.id, req.user.id]).catch(() => {});
  }
  res.json({ ok: true });
}));

r.delete('/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const x = await one('UPDATE sparks SET deleted_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!x) throw notFound('Spark not found');
  res.json({ ok: true });
}));

export default r;
