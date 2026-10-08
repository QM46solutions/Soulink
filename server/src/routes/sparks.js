// Sparks 🎬: short videos (up to 60 s) in 5 categories, each with its own extras.
//  GET    /sparks?category=&before=   the Sparks tab (everyone's, newest first; filter by category)
//  GET    /sparks/user/:userId        someone's Sparks
//  POST   /sparks                     multipart: video (required), music? + category, caption, place?, details (json), oneTake=1|0
//  POST   /sparks/:id/react           the category reaction (😍 / 😋 / 👏 / 💪 / 💡), toggle
//  POST   /sparks/:id/tried           cooking "I tried it" / fitness "I did it", toggle
//  POST   /sparks/:id/view            counts a view (once a day per person)
//  DELETE /sparks/:id                 delete my Spark
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { notify, userCard } from '../services/social.js';
import { REF_RE, playPath } from '../services/music.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
export const SPARK_CATEGORIES = ['travel', 'cooking', 'acting', 'fitness', 'news'];

// Spark studio edits (kept with the Spark and applied when it plays): trim, speed, filter, text, stickers, music mix, cover
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const EDIT = z.object({
  trim: z.tuple([z.number().min(0).max(600), z.number().min(0).max(600)]).optional(),
  speed: z.enum(['0.5', '1', '1.5', '2']).optional(),
  filter: z.enum(['none', 'warm', 'cool', 'vivid', 'mono', 'vintage', 'dream', 'noir', 'fade']).optional(),
  texts: z.array(z.object({ t: z.string().trim().min(1).max(80), x: z.number().min(0).max(1), y: z.number().min(0).max(1), color: hex, style: z.enum(['classic', 'neon', 'box', 'bold']), size: z.number().min(12).max(72) })).max(10).optional(),
  stickers: z.array(z.object({ e: z.string().min(1).max(16), x: z.number().min(0).max(1), y: z.number().min(0).max(1), size: z.number().min(20).max(160) })).max(15).optional(),
  musicStart: z.number().min(0).max(1200).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  videoVolume: z.number().min(0).max(1).optional(),
  cover: z.number().min(0).max(600).optional(),
}).refine((e) => !e.trim || (e.trim[1] > e.trim[0] && e.trim[1] - e.trim[0] <= 61), 'A Spark is up to 60 seconds');

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
  fitness: z.object({
    type: z.enum(['gym', 'yoga', 'run', 'home', 'sport', 'dance', 'transformation']).optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    minutes: z.number().int().min(1).max(600).optional(),
    moves: z.array(z.string().trim().min(1).max(80)).max(20).optional(), // "Squats × 15"
    challenge: z.string().trim().max(120).optional(),                  // the challenge of the week they took
  }),
  news: z.object({
    headline: z.string().trim().min(1).max(120).optional(),
    topic: z.enum(['local', 'india', 'world', 'tech', 'sports', 'cinema', 'business', 'good']).optional(),
    source: z.string().trim().url().max(300).refine((u) => /^https?:\/\//i.test(u), 'Use a web link').optional(),
  }),
};

for (const k of Object.keys(DETAILS)) DETAILS[k] = DETAILS[k].extend({ edit: EDIT.optional() });

// ---- Open Mic Stage: one theme a week; Sparks made for it are tagged with the week ----
const STAGE_THEMES = [
  { title: 'A song from your childhood', line: 'Sing it, play it, or act the memory' },
  { title: 'Hyderabad nights', line: 'Show us your city after dark' },
  { title: 'One minute of stand-up', line: 'Your best 60 seconds of comedy' },
  { title: 'The letter I never sent', line: 'Poetry, a monologue or a song' },
  { title: 'Mimic someone famous', line: 'A star, a teacher, a cricket commentator…' },
  { title: 'Cook your comfort food', line: 'And tell us why it is yours' },
  { title: 'Dance like nobody is watching', line: 'Any style, any song' },
  { title: 'My hidden talent', line: 'The thing nobody knows you can do' },
];
export function stageWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const themeOf = (week) => STAGE_THEMES[Number(week.slice(-2)) % STAGE_THEMES.length];

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
  castingId: x.casting_id || null, stageWeek: x.stage_week || null,
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
    musicRef: z.string().regex(REF_RE, 'Pick the song again').optional(), // a song from JioSaavn / Deezer / free music
    details: z.string().optional(),
    oneTake: z.enum(['0', '1']).default('0'),
    castingId: uuid.optional(),   // an audition for a Casting Board role
    stage: z.enum(['0', '1']).default('0'), // a performance for this week's Open Mic
  }).parse(req.body || {});
  let casting = null;
  if (b.castingId) {
    casting = await one('SELECT * FROM casting_calls WHERE id=$1 AND deleted_at IS NULL', [b.castingId]);
    if (!casting) throw notFound('That casting call is gone');
    if (new Date(casting.ends_at) < new Date() || casting.picked_spark_id) throw badRequest('Auditions for this role are closed', 'casting_closed');
  }
  let details = {};
  try { details = b.details ? DETAILS[b.category].parse(JSON.parse(b.details)) : {}; } catch { throw badRequest('Some of the extra details are not right'); }
  if (b.category === 'travel' && !b.place) throw badRequest('Add the place for a travel Spark', 'no_place');
  const videoUrl = await saveFile(video, 'sparks', 'spark');
  const musicUrl = music ? await saveFile(music, 'sparks', 'spark') : b.musicRef ? playPath(b.musicRef) : null;
  const x = await one(
    `INSERT INTO sparks (author_id, category, video_url, music_url, music_title, caption, place, details, one_take, casting_id, stage_week)
     OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [req.user.id, b.category, videoUrl, musicUrl, musicUrl ? (b.musicTitle || music?.originalname?.replace(/\.[a-z0-9]{2,4}$/i, '') || 'Music') : null, b.caption, b.place || null, JSON.stringify(details), b.oneTake === '1',
      casting ? casting.id : null, b.stage === '1' ? stageWeek() : null],
  );
  if (casting && String(casting.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) {
    await notify(casting.author_id, req.user.id, 'casting_audition', x.id, { title: casting.title }).catch(() => {});
  }
  const row = await one(`${SELECT} WHERE s.id = $2`, [req.user.id, x.id]);
  res.status(201).json({ spark: view(row, req.user.id) });
}));

// ---------- Casting Board ----------
const castingView = (c, me, extra = {}) => ({
  id: c.id, title: c.title, role: c.role, script: c.script || null, category: c.category, endsAt: c.ends_at, createdAt: c.created_at,
  pickedSparkId: c.picked_spark_id || null, open: !c.picked_spark_id && new Date(c.ends_at) > new Date(),
  mine: String(c.author_id).toLowerCase() === String(me).toLowerCase(), auditions: Number(c.auditions || 0),
  author: c.username ? userCard({ ...c, id: c.uid }) : null, ...extra,
});
const CASTING_SELECT = `SELECT c.*, u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type,
    (SELECT COUNT(*) FROM sparks s WHERE s.casting_id = c.id AND s.deleted_at IS NULL) AS auditions
  FROM casting_calls c JOIN users u ON u.id = c.author_id`;

r.get('/casting', ah(async (req, res) => {
  const rows = await many(`${CASTING_SELECT} WHERE c.deleted_at IS NULL AND (c.ends_at > DATEADD(DAY, -14, SYSDATETIMEOFFSET()))
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = c.author_id) OR (b.blocker_id = c.author_id AND b.blocked_id = $1))
    ORDER BY CASE WHEN c.picked_spark_id IS NULL AND c.ends_at > SYSDATETIMEOFFSET() THEN 0 ELSE 1 END, c.created_at DESC
    OFFSET 0 ROWS FETCH NEXT 40 ROWS ONLY`, [req.user.id]);
  res.json({ calls: rows.map((c) => castingView(c, req.user.id)) });
}));

r.post('/casting', requireSoul, ah(async (req, res) => {
  const d = z.object({
    title: z.string().trim().min(3, 'Give the role a title').max(100),
    role: z.string().trim().min(5, 'Describe who you are looking for').max(300),
    script: z.string().trim().max(1000).optional(),
    category: z.enum(SPARK_CATEGORIES).default('acting'),
    days: z.number().int().min(1).max(30).default(7),
  }).parse(req.body || {});
  const c = await one(`INSERT INTO casting_calls (author_id, title, role, script, category, ends_at) OUTPUT INSERTED.id
                       VALUES ($1, $2, $3, $4, $5, DATEADD(DAY, $6, SYSDATETIMEOFFSET()))`, [req.user.id, d.title, d.role, d.script || null, d.category, d.days]);
  const row = await one(`${CASTING_SELECT} WHERE c.id = $1`, [c.id]);
  res.status(201).json({ call: castingView(row, req.user.id) });
}));

r.get('/casting/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const c = await one(`${CASTING_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`, [id]);
  if (!c) throw notFound('Casting call not found');
  const auditions = await many(`${SELECT} WHERE ${VISIBLE} AND s.casting_id = $2
      ORDER BY CASE WHEN s.id = $3 THEN 0 ELSE 1 END, (SELECT COUNT(*) FROM spark_reactions x WHERE x.spark_id = s.id) DESC, s.created_at DESC`, [req.user.id, id, c.picked_spark_id || id]);
  res.json({ call: castingView(c, req.user.id), auditions: auditions.map((x) => view(x, req.user.id)) });
}));

// the caster picks the audition they liked: the role closes and the actor is told
r.post('/casting/:id/pick', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sparkId } = z.object({ sparkId: uuid }).parse(req.body || {});
  const c = await one('SELECT * FROM casting_calls WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!c) throw notFound('Casting call not found');
  if (c.picked_spark_id) throw badRequest('You already picked someone for this role', 'already_picked');
  const sp = await one('SELECT id, author_id FROM sparks WHERE id=$1 AND casting_id=$2 AND deleted_at IS NULL', [sparkId, id]);
  if (!sp) throw notFound('That audition is not for this role');
  await query('UPDATE casting_calls SET picked_spark_id=$2 WHERE id=$1', [id, sp.id]);
  await notify(sp.author_id, req.user.id, 'casting_pick', sp.id, { title: c.title }).catch(() => {});
  res.json({ ok: true, pickedSparkId: sp.id });
}));

r.delete('/casting/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const c = await one('UPDATE casting_calls SET deleted_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!c) throw notFound('Casting call not found');
  res.json({ ok: true });
}));

// ---------- Open Mic Stage ----------
const SPOT_KINDS = ['any', 'comedy', 'music', 'poetry', 'acting', 'dance'];
const spotView = (x, me) => ({
  id: x.id, title: x.title, venue: x.venue, city: x.city, startsAt: x.starts_at, kind: x.kind, link: x.link || null, note: x.note || null,
  going: Number(x.going || 0), performing: Number(x.performing || 0), myRsvp: x.my_rsvp || null,
  mine: String(x.author_id).toLowerCase() === String(me).toLowerCase(),
  author: userCard({ ...x, id: x.uid }),
});
const SPOT_SELECT = `SELECT p.*, u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type,
    (SELECT COUNT(*) FROM stage_rsvps r WHERE r.spot_id = p.id AND r.kind = N'going') AS going,
    (SELECT COUNT(*) FROM stage_rsvps r WHERE r.spot_id = p.id AND r.kind = N'perform') AS performing,
    (SELECT TOP 1 r.kind FROM stage_rsvps r WHERE r.spot_id = p.id AND r.user_id = $1) AS my_rsvp
  FROM stage_spots p JOIN users u ON u.id = p.author_id`;

// GET /sparks/stage?city= → this week's theme, the top performances so far, and open mics coming up
r.get('/stage', ah(async (req, res) => {
  const week = stageWeek();
  const city = z.string().trim().max(80).optional().parse(req.query.city || undefined);
  const top = await many(`${SELECT} WHERE ${VISIBLE} AND s.stage_week = $2
      ORDER BY (SELECT COUNT(*) FROM spark_reactions x WHERE x.spark_id = s.id) DESC, s.created_at DESC
      OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY`, [req.user.id, week]);
  const spots = await many(`${SPOT_SELECT} WHERE p.deleted_at IS NULL AND p.starts_at > DATEADD(HOUR, -3, SYSDATETIMEOFFSET())
      AND ($2 IS NULL OR p.city LIKE '%' + $2 + '%')
    ORDER BY p.starts_at ASC OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY`, [req.user.id, city || null]);
  res.json({ week, theme: themeOf(week), top: top.map((x) => view(x, req.user.id)), spots: spots.map((x) => spotView(x, req.user.id)) });
}));

r.post('/stage/spots', requireSoul, ah(async (req, res) => {
  const d = z.object({
    title: z.string().trim().min(3, 'Name the open mic').max(100),
    venue: z.string().trim().min(2, 'Where is it?').max(150),
    city: z.string().trim().min(2, 'Which city?').max(80),
    startsAt: z.string().datetime({ offset: true }),
    kind: z.enum(SPOT_KINDS).default('any'),
    link: z.string().trim().url().max(300).refine((u) => /^https?:\/\//i.test(u), 'Use a web link').optional(),
    note: z.string().trim().max(300).optional(),
  }).parse(req.body || {});
  if (new Date(d.startsAt) < new Date(Date.now() - 3600_000)) throw badRequest('Pick a date that is still coming', 'past');
  const p = await one(`INSERT INTO stage_spots (author_id, title, venue, city, starts_at, kind, link, note) OUTPUT INSERTED.id
                       VALUES ($1, $2, $3, $4, CAST($5 AS DATETIMEOFFSET), $6, $7, $8)`, [req.user.id, d.title, d.venue, d.city, d.startsAt, d.kind, d.link || null, d.note || null]);
  await query("INSERT INTO stage_rsvps (spot_id, user_id, kind) VALUES ($1, $2, N'going')", [p.id, req.user.id]);
  const row = await one(`${SPOT_SELECT} WHERE p.id = $2`, [req.user.id, p.id]);
  res.status(201).json({ spot: spotView(row, req.user.id) });
}));

// { kind: 'going' | 'perform' | null } — same kind again (or null) removes it
r.post('/stage/spots/:id/rsvp', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { kind } = z.object({ kind: z.enum(['going', 'perform']).nullable() }).parse(req.body || {});
  const spot = await one('SELECT id FROM stage_spots WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!spot) throw notFound('Open mic not found');
  const cur = await one('SELECT kind FROM stage_rsvps WHERE spot_id=$1 AND user_id=$2', [id, req.user.id]);
  if (!kind || cur?.kind === kind) await query('DELETE FROM stage_rsvps WHERE spot_id=$1 AND user_id=$2', [id, req.user.id]);
  else if (cur) await query('UPDATE stage_rsvps SET kind=$3 WHERE spot_id=$1 AND user_id=$2', [id, req.user.id, kind]);
  else await query('INSERT INTO stage_rsvps (spot_id, user_id, kind) VALUES ($1, $2, $3)', [id, req.user.id, kind]);
  const row = await one(`${SPOT_SELECT} WHERE p.id = $2`, [req.user.id, id]);
  res.json({ spot: spotView(row, req.user.id) });
}));

r.delete('/stage/spots/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const p = await one('UPDATE stage_spots SET deleted_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!p) throw notFound('Open mic not found');
  res.json({ ok: true });
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
  if (x.category !== 'cooking' && x.category !== 'fitness') throw badRequest('"I tried it" is for cooking and fitness Sparks');
  if (x.i_tried) await query('DELETE FROM spark_tried WHERE spark_id=$1 AND user_id=$2', [x.id, req.user.id]);
  else {
    await query('INSERT INTO spark_tried (spark_id, user_id) VALUES ($1, $2)', [x.id, req.user.id]);
    await notify(x.author_id, req.user.id, 'spark_tried', x.id, { category: x.category, dish: parse(x.details)?.dish || null }).catch(() => {});
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
