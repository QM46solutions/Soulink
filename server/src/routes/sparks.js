// Sparks 🎬: short videos (up to 60 s) in 5 categories, each with its own extras.
//  GET    /sparks?category=&before=   the Sparks tab (everyone's, newest first; filter by category)
//  GET    /sparks/user/:userId        someone's Sparks
//  POST   /sparks                     multipart: video (required), music? + category, caption, place?, details (json), oneTake=1|0
//  POST   /sparks/:id/react           the category reaction (😍 / 😋 / 👏 / 💪 / 💡), toggle
//  POST   /sparks/:id/tried           cooking "I tried it" / fitness "I did it", toggle
//  POST   /sparks/:id/view            counts a view (once a day per person)
//  DELETE /sparks/:id                 delete my Spark
//  GET    /sparks/:id                 one Spark (opened from a chat or a notification)
//  GET/POST /sparks/:id/comments      comments with replies; /:cid/like, /:cid/offense, DELETE /:cid
//  POST   /sparks/:id/offense         mark / unmark as offensive (more than 75 marks suspends it)
//  POST   /sparks/:id/share           { conversationIds?: [...] } send it in chats, or {} = shared outside Soulink
//  GET    /sparks/spread/plans        Spread around prices
//  GET    /sparks/:id/spread          my Spark's Spread status
//  POST   /sparks/:id/spread          { days, city: 'mine'|'all', ageMin, ageMax } show it to more people
//  POST   /sparks/:id/spread/stop     stop spreading
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { notify, userCard } from '../services/social.js';
import { REF_RE, playPath } from '../services/music.js';
import { paymentMode, takePayment } from '../lib/payments.js';
import { OFFENSE_REASONS, OFFENSE_LIMIT } from './posts.js';
import { sharePostToChat } from './conversations.js';

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
  texts: z.array(z.object({ t: z.string().trim().min(1).max(80), x: z.number().min(0).max(1), y: z.number().min(0).max(1), color: hex, style: z.enum(['classic', 'neon', 'box', 'bold']), size: z.number().min(12).max(72), from: z.number().min(0).max(600).optional(), to: z.number().min(0).max(600).optional() })).max(10).optional(),
  stickers: z.array(z.object({ e: z.string().min(1).max(16), x: z.number().min(0).max(1), y: z.number().min(0).max(1), size: z.number().min(20).max(160) })).max(15).optional(),
  musicStart: z.number().min(0).max(1200).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  videoVolume: z.number().min(0).max(1).optional(),
  cover: z.number().min(0).max(600).optional(),
  adjust: z.object({ b: z.number().min(-1).max(1), c: z.number().min(-1).max(1), s: z.number().min(-1).max(1), w: z.number().min(-1).max(1) }).partial().optional(),
  zoom: z.object({ s: z.number().min(1).max(3), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  fade: z.object({ in: z.number().min(0).max(3), out: z.number().min(0).max(3) }).partial().optional(),
  voiceVolume: z.number().min(0).max(1).optional(),
  voice: z.string().max(400).optional(), // set by the server from the uploaded voiceover
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
    (SELECT COUNT(*) FROM spark_comments c WHERE c.spark_id = s.id AND c.deleted_at IS NULL AND c.hidden_at IS NULL) AS comment_count,
    CASE WHEN EXISTS (SELECT 1 FROM spark_comments c WHERE c.spark_id = s.id AND c.author_id = $1 AND c.deleted_at IS NULL) THEN 1 ELSE 0 END AS commented,
    (SELECT COUNT(*) FROM spark_offenses o WHERE o.spark_id = s.id) AS offense_count,
    (SELECT TOP 1 ISNULL(o.reason, N'other') FROM spark_offenses o WHERE o.spark_id = s.id AND o.user_id = $1) AS offense_reason,
    (SELECT COUNT(*) FROM spark_shares sh WHERE sh.spark_id = s.id) AS share_count,
    CASE WHEN EXISTS (SELECT 1 FROM spark_shares sh WHERE sh.spark_id = s.id AND sh.user_id = $1) THEN 1 ELSE 0 END AS shared,
    u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
  FROM sparks s JOIN users u ON u.id = s.author_id`;
// Sparks are a public stage, except from private accounts (only their Connections / Followers see those) and blocked people
const VISIBLE = `s.deleted_at IS NULL AND (s.suspended_at IS NULL OR s.author_id = $1)
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
  commentCount: Number(x.comment_count || 0), commented: !!x.commented,
  offenseCount: Number(x.offense_count || 0), offended: !!x.offense_reason, offenseReason: x.offense_reason || null,
  shareCount: Number(x.share_count || 0), shared: !!x.shared, suspended: !!x.suspended_at,
  ...(x.spread_id ? { spread: true } : {}),
});

r.get('/', ah(async (req, res) => {
  const category = z.enum(SPARK_CATEGORIES).optional().parse(req.query.category || undefined);
  const before = req.query.before ? z.string().datetime({ offset: true }).parse(req.query.before) : null;
  const rows = await many(
    `${SELECT} WHERE ${VISIBLE} AND ($2 IS NULL OR s.category = $2) AND ($3 IS NULL OR s.created_at < CAST($3 AS DATETIMEOFFSET))
      ORDER BY s.created_at DESC OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY`, [req.user.id, category || null, before]);
  const sparks = rows.map((x) => view(x, req.user.id));
  // Spread around: up to 2 boosted Sparks for this viewer (their city / age), placed at about the 3rd and 9th spot
  if (!before) try {
    const age = req.user.birth_date ? Math.floor((Date.now() - new Date(req.user.birth_date)) / 31557600000) : null;
    const boosted = await many(`SELECT TOP 2 sp.id AS spread_id, x.* FROM spark_spreads sp
        CROSS APPLY (${SELECT} WHERE s.id = sp.spark_id AND ${VISIBLE}) x
        WHERE sp.status IN (N'active', N'test') AND sp.ends_at > SYSDATETIMEOFFSET()
          AND sp.user_id <> $1 AND ($2 IS NULL OR x.category = $2)
          AND (sp.city IS NULL OR sp.city = $3)
          AND ($4 IS NULL OR ($4 BETWEEN sp.age_min AND sp.age_max))
        ORDER BY NEWID()`, [req.user.id, category || null, req.user.city || '', age]);
    let at = 2;
    for (const b of boosted) {
      const v = view(b, req.user.id);
      const i = sparks.findIndex((x) => x.id === v.id);
      if (i >= 0) sparks.splice(i, 1);
      sparks.splice(Math.min(at, sparks.length), 0, v); at += 6;
      await query('UPDATE spark_spreads SET impressions = impressions + 1 WHERE id = $1', [b.spread_id]).catch(() => {});
    }
  } catch { /* the feed still works without boosts */ }
  res.json({ sparks, hasMore: rows.length === 20 });
}));

// ---------- Spread around (boost a Spark) ----------
export const SPREAD_PLANS = [
  { days: 1, priceInr: 49, reach: '1-2K people' },
  { days: 3, priceInr: 129, reach: '4-6K people' },
  { days: 7, priceInr: 249, reach: '10-15K people' },
];
const spreadView = (sp) => sp ? ({
  id: sp.id, days: sp.days, city: sp.city || null, ageMin: sp.age_min, ageMax: sp.age_max, priceInr: Math.round(sp.amount_paise / 100),
  test: sp.status === 'test', live: sp.status !== 'stopped' && new Date(sp.ends_at) > new Date(),
  startsAt: sp.starts_at, endsAt: sp.ends_at, impressions: Number(sp.impressions || 0),
}) : null;

r.get('/spread/plans', ah(async (req, res) => {
  const mode = paymentMode();
  res.json({ plans: SPREAD_PLANS, available: mode !== 'off', test: mode === 'test', myCity: req.user.city || null });
}));

r.get('/user/:userId', ah(async (req, res) => {
  const id = uuid.parse(req.params.userId);
  const rows = await many(`${SELECT} WHERE ${VISIBLE} AND s.author_id = $2 ORDER BY s.created_at DESC`, [req.user.id, id]);
  res.json({ sparks: rows.map((x) => view(x, req.user.id)) });
}));

r.post('/', requireSoul, uploadMemory('spark', 40, 2).fields([{ name: 'video', maxCount: 1 }, { name: 'music', maxCount: 1 }, { name: 'voice', maxCount: 1 }]), ah(async (req, res) => {
  const video = req.files?.video?.[0]; const music = req.files?.music?.[0]; const voice = req.files?.voice?.[0];
  if (!video || !video.mimetype.startsWith('video/')) throw badRequest('Add a video first (up to 60 seconds)', 'no_video');
  if (music && !music.mimetype.startsWith('audio/')) throw badRequest('Music must be an audio file');
  if (voice && !/^(audio|video)\//.test(voice.mimetype)) throw badRequest('The voiceover must be audio');
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
  if (details.edit) delete details.edit.voice;
  if (voice) details.edit = { ...(details.edit || {}), voice: await saveFile(voice, 'sparks', 'spark') };
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

async function mySpark(req) {
  const id = uuid.parse(req.params.id);
  const x = await one('SELECT id, author_id FROM sparks WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!x || String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) throw notFound('Spark not found');
  return x;
}
const currentSpread = (sparkId) => one(`SELECT TOP 1 * FROM spark_spreads WHERE spark_id=$1 AND status <> N'stopped' AND ends_at > SYSDATETIMEOFFSET() ORDER BY ends_at DESC`, [sparkId]);

r.get('/:id/spread', ah(async (req, res) => {
  const x = await mySpark(req);
  const sp = await currentSpread(x.id);
  const views = await one('SELECT COUNT(*) AS n FROM spark_views WHERE spark_id=$1', [x.id]);
  res.json({ spread: spreadView(sp), views: Number(views.n) });
}));

r.post('/:id/spread', requireSoul, ah(async (req, res) => {
  const x = await mySpark(req);
  const d = z.object({
    days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
    city: z.enum(['mine', 'all']).default('all'),
    ageMin: z.number().int().min(18).max(80).default(18),
    ageMax: z.number().int().min(18).max(80).default(60),
    paymentRef: z.string().max(120).optional(),
  }).refine((v) => v.ageMax >= v.ageMin, 'Check the ages').parse(req.body || {});
  if (await currentSpread(x.id)) throw badRequest('This Spark is already spreading', 'already_spreading');
  if (d.city === 'mine' && !req.user.city) throw badRequest('Add your city in your profile first, or pick All of India', 'no_city');
  const plan = SPREAD_PLANS.find((p) => p.days === d.days);
  const mode = takePayment(d.paymentRef); // 'test' on the laptop: nothing is charged
  const sp = await one(`INSERT INTO spark_spreads (spark_id, user_id, city, age_min, age_max, days, amount_paise, payment_ref, status, ends_at)
      OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, DATEADD(DAY, $6, SYSDATETIMEOFFSET()))`,
    [x.id, req.user.id, d.city === 'mine' ? req.user.city : null, d.ageMin, d.ageMax, d.days, plan.priceInr * 100, d.paymentRef || null, mode === 'test' ? 'test' : 'active']);
  res.status(201).json({ spread: spreadView(sp) });
}));

r.post('/:id/spread/stop', ah(async (req, res) => {
  const x = await mySpark(req);
  await query(`UPDATE spark_spreads SET status = N'stopped' WHERE spark_id=$1 AND status <> N'stopped'`, [x.id]);
  res.json({ spread: null });
}));

// ---------- one Spark, comments, offense marks, shares (the same tools as posts) ----------
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const SPARK_COMMENT_HIDE_AT = 10;

r.get('/:id', ah(async (req, res) => {
  const x = await visible(req);
  res.json({ spark: view(x, req.user.id) });
}));

r.get('/:id/comments', ah(async (req, res) => {
  const x = await visible(req);
  const me = req.user.id;
  const rows = await many(
    `SELECT c.id AS comment_id, c.body, c.created_at AS comment_at, c.author_id, c.parent_id, c.hidden_at,
            (SELECT COUNT(*) FROM spark_comment_likes l WHERE l.comment_id = c.id) AS like_count,
            CASE WHEN EXISTS (SELECT 1 FROM spark_comment_likes l WHERE l.comment_id = c.id AND l.user_id = $2) THEN 1 ELSE 0 END AS liked,
            (SELECT COUNT(*) FROM spark_comment_offenses o WHERE o.comment_id = c.id) AS offense_count,
            (SELECT TOP 1 o.reason FROM spark_comment_offenses o WHERE o.comment_id = c.id AND o.user_id = $2) AS my_reason,
            CASE WHEN EXISTS (SELECT 1 FROM spark_comment_offenses o WHERE o.comment_id = c.id AND o.user_id = $2) THEN 1 ELSE 0 END AS offended,
            u.*
       FROM spark_comments c JOIN users u ON u.id = c.author_id
      WHERE c.spark_id=$1 AND c.deleted_at IS NULL AND (c.hidden_at IS NULL OR c.author_id = $2)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=c.author_id) OR (b.blocker_id=c.author_id AND b.blocked_id=$2))
      ORDER BY c.created_at`, [x.id, me],
  );
  const sparkMine = same(x.author_id, me);
  const ids = new Set(rows.map((c) => String(c.comment_id).toLowerCase()));
  res.json({
    commentsOff: false,
    comments: rows.map((c) => ({
      id: c.comment_id, body: c.body, createdAt: c.comment_at, author: userCard(c),
      parentId: c.parent_id && ids.has(String(c.parent_id).toLowerCase()) ? c.parent_id : null,
      likeCount: Number(c.like_count || 0), liked: !!c.liked,
      offenseCount: Number(c.offense_count || 0), offended: !!c.offended, offenseReason: c.my_reason || null,
      hidden: !!c.hidden_at, mine: same(c.author_id, me), canDelete: sparkMine || same(c.author_id, me),
    })),
  });
}));

r.post('/:id/comments', ah(async (req, res) => {
  const x = await visible(req);
  const { body, parentId } = z.object({ body: z.string().trim().min(1).max(2200), parentId: uuid.optional() }).parse(req.body || {});
  let parent = null;
  if (parentId) {
    parent = await one('SELECT * FROM spark_comments WHERE id=$1 AND spark_id=$2 AND deleted_at IS NULL', [parentId, x.id]);
    if (!parent) throw notFound('That comment was deleted');
    if (parent.parent_id) parent = (await one('SELECT * FROM spark_comments WHERE id=$1', [parent.parent_id])) || parent; // replies stay one level deep
  }
  const c = await one('INSERT INTO spark_comments (spark_id, author_id, body, parent_id) OUTPUT INSERTED.* VALUES ($1, $2, $3, $4)', [x.id, req.user.id, body, parent?.id || null]);
  if (!same(x.author_id, req.user.id)) await notify(x.author_id, req.user.id, 'spark_comment', x.id, { preview: body.slice(0, 80) }).catch(() => {});
  if (parent && !same(parent.author_id, x.author_id) && !same(parent.author_id, req.user.id)) await notify(parent.author_id, req.user.id, 'spark_comment_reply', x.id, { preview: body.slice(0, 80) }).catch(() => {});
  res.status(201).json({ comment: { id: c.id, body: c.body, createdAt: c.created_at, author: userCard(req.user), parentId: parent?.id || null,
    likeCount: 0, liked: false, offenseCount: 0, offended: false, offenseReason: null, hidden: false, mine: true, canDelete: true } });
}));

async function sparkComment(req) {
  const x = await visible(req);
  const cid = uuid.parse(req.params.cid);
  const c = await one('SELECT * FROM spark_comments WHERE id=$1 AND spark_id=$2 AND deleted_at IS NULL', [cid, x.id]);
  if (!c) throw notFound('Comment not found');
  return { x, c };
}

r.post('/:id/comments/:cid/like', ah(async (req, res) => {
  const { x, c } = await sparkComment(req);
  const had = await one('SELECT 1 AS y FROM spark_comment_likes WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  if (had) await query('DELETE FROM spark_comment_likes WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  else {
    await query('INSERT INTO spark_comment_likes (comment_id, user_id) VALUES ($1, $2)', [c.id, req.user.id]);
    if (!same(c.author_id, req.user.id)) await notify(c.author_id, req.user.id, 'spark_comment_like', x.id, { preview: String(c.body).slice(0, 80) }).catch(() => {});
  }
  const n = await one('SELECT COUNT(*) AS n FROM spark_comment_likes WHERE comment_id=$1', [c.id]);
  res.json({ liked: !had, likeCount: Number(n.n) });
}));

r.post('/:id/comments/:cid/offense', ah(async (req, res) => {
  const { c } = await sparkComment(req);
  const { reason } = z.object({ reason: z.enum(OFFENSE_REASONS).optional() }).parse(req.body || {});
  if (same(c.author_id, req.user.id)) throw badRequest("You can't mark your own comment");
  const had = await one('SELECT 1 AS y FROM spark_comment_offenses WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  if (had) await query('DELETE FROM spark_comment_offenses WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  else await query('INSERT INTO spark_comment_offenses (comment_id, user_id, reason) VALUES ($1, $2, $3)', [c.id, req.user.id, reason || null]);
  const n = Number((await one('SELECT COUNT(*) AS n FROM spark_comment_offenses WHERE comment_id=$1', [c.id])).n);
  await query(`UPDATE spark_comments SET hidden_at = ${n > SPARK_COMMENT_HIDE_AT ? 'COALESCE(hidden_at, SYSDATETIMEOFFSET())' : 'NULL'} WHERE id=$1`, [c.id]);
  res.json({ offended: !had, offenseCount: n, hidden: n > SPARK_COMMENT_HIDE_AT });
}));

r.delete('/:id/comments/:cid', ah(async (req, res) => {
  const { x, c } = await sparkComment(req);
  if (!same(c.author_id, req.user.id) && !same(x.author_id, req.user.id)) throw forbidden('You can only delete your own comments', 'not_yours');
  await query('UPDATE spark_comments SET deleted_at = SYSDATETIMEOFFSET() WHERE id=$1 OR parent_id=$1', [c.id]);
  res.json({ ok: true });
}));

// ❗ mark a Spark as offensive (toggle). More than 75 marks suspends it (only its owner still sees it).
r.post('/:id/offense', ah(async (req, res) => {
  const x = await visible(req);
  if (same(x.author_id, req.user.id)) throw badRequest("You can't mark your own Spark", 'own_spark');
  const { reason } = z.object({ reason: z.enum(OFFENSE_REASONS).optional() }).parse(req.body || {});
  const had = await one('SELECT 1 AS y FROM spark_offenses WHERE spark_id=$1 AND user_id=$2', [x.id, req.user.id]);
  if (had) await query('DELETE FROM spark_offenses WHERE spark_id=$1 AND user_id=$2', [x.id, req.user.id]);
  else await query('INSERT INTO spark_offenses (spark_id, user_id, reason) VALUES ($1, $2, $3)', [x.id, req.user.id, reason || 'other']);
  const n = Number((await one('SELECT COUNT(*) AS n FROM spark_offenses WHERE spark_id=$1', [x.id])).n);
  let suspended = !!x.suspended_at;
  if (!suspended && n > OFFENSE_LIMIT) {
    const upd = await one('UPDATE sparks SET suspended_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND suspended_at IS NULL', [x.id]);
    if (upd) { suspended = true; await notify(x.author_id, null, 'spark_suspended', x.id, { offenses: n }).catch(() => {}); }
  }
  res.json({ offended: !had, suspended, offenseCount: n });
}));

// Owner only: how many people marked my Spark, by reason (never who)
r.get('/:id/offenses', ah(async (req, res) => {
  const x = await visible(req);
  if (!same(x.author_id, req.user.id)) throw forbidden('Only the person who posted this can see this', 'not_owner');
  const rows = await many("SELECT ISNULL(reason, N'other') AS reason, COUNT(*) AS n FROM spark_offenses WHERE spark_id=$1 GROUP BY ISNULL(reason, N'other')", [x.id]);
  res.json({ total: rows.reduce((a, q) => a + Number(q.n), 0), byReason: Object.fromEntries(rows.map((q) => [q.reason, Number(q.n)])), limit: OFFENSE_LIMIT, suspended: !!x.suspended_at });
}));

r.post('/:id/share', ah(async (req, res) => {
  const x = await visible(req);
  const { conversationIds } = z.object({ conversationIds: z.array(uuid).max(20).optional() }).parse(req.body || {});
  const snapshot = { sparkId: x.id, category: x.category, caption: (x.caption || '').slice(0, 140), author: { username: x.username, avatarUrl: x.avatar_url } };
  let sent = 0;
  for (const cid of conversationIds || []) {
    await sharePostToChat(cid, req.user, snapshot); sent += 1;
    await query(`INSERT INTO spark_shares (spark_id, user_id, channel) VALUES ($1, $2, N'chat')`, [x.id, req.user.id]);
  }
  if (!conversationIds?.length) await query(`INSERT INTO spark_shares (spark_id, user_id, channel) VALUES ($1, $2, N'external')`, [x.id, req.user.id]);
  const n = await one('SELECT COUNT(*) AS n FROM spark_shares WHERE spark_id=$1', [x.id]);
  res.json({ ok: true, sent, shareCount: Number(n.n) });
}));

r.delete('/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const x = await one('UPDATE sparks SET deleted_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!x) throw notFound('Spark not found');
  res.json({ ok: true });
}));

export default r;
