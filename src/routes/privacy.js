// Privacy settings (see services/privacy.js for what each one does)
//  GET /privacy                       my settings + the people on my Restricted / Muted / Hide-Moments lists
//  PUT /privacy                       { commentWho?, connectWho?, momentReplies?, showActivity?, readReceipts?,
//                                       hideOffensive?, hiddenWords?, limitDays? (0 = stop limiting, 1, 7 or 30) }
//  GET /privacy/people/:userId        what I've set for this person { restricted, mutePosts, muteMoments, momentsHidden }
//  PUT /privacy/people/:userId        { restricted?, mutePosts?, muteMoments?, momentsHidden? }
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';
import { COMMENT_WHO, CONNECT_WHO, LIMIT_DAYS, listPeople, privacyView } from '../services/privacy.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const card = (u) => ({ ...userCard(u), listedAt: u.listed_at, ...(u.mute_posts !== undefined ? { mutePosts: !!u.mute_posts, muteMoments: !!u.mute_moments } : {}) });

r.get('/', ah(async (req, res) => {
  const [restricted, muted, momentsHidden] = await Promise.all(['restricted', 'muted', 'momentsHidden'].map((l) => listPeople(req.user.id, l)));
  res.json({ privacy: privacyView(req.user), restricted: restricted.map(card), muted: muted.map(card), momentsHidden: momentsHidden.map(card), limitDays: LIMIT_DAYS });
}));

r.put('/', ah(async (req, res) => {
  const d = z.object({
    commentWho: z.enum(COMMENT_WHO).optional(), connectWho: z.enum(CONNECT_WHO).optional(),
    momentReplies: z.boolean().optional(), showActivity: z.boolean().optional(), readReceipts: z.boolean().optional(),
    hideOffensive: z.boolean().optional(),
    hiddenWords: z.array(z.string().trim().min(1).max(40)).max(100).optional(),
    limitDays: z.union([z.literal(0), ...LIMIT_DAYS.map((n) => z.literal(n))]).optional(),
  }).strict().parse(req.body || {});
  const sets = []; const vals = [req.user.id];
  const put = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
  if (d.commentWho) put('comment_who', d.commentWho);
  if (d.connectWho) put('connect_who', d.connectWho);
  if (d.momentReplies !== undefined) put('moment_replies', d.momentReplies ? 1 : 0);
  if (d.showActivity !== undefined) put('show_activity', d.showActivity ? 1 : 0);
  if (d.readReceipts !== undefined) put('read_receipts', d.readReceipts ? 1 : 0);
  if (d.hideOffensive !== undefined) put('hide_offensive', d.hideOffensive ? 1 : 0);
  if (d.hiddenWords) {
    const words = [...new Set(d.hiddenWords.map((w) => w.toLowerCase().replace(/,/g, ' ').trim()).filter(Boolean))];
    const joined = words.join(',');
    if (joined.length > 2000) throw badRequest('That list is too long. Remove a few words.', 'too_many_words');
    put('hidden_words', joined || null);
  }
  if (d.limitDays !== undefined) {
    if (d.limitDays === 0) sets.push('limit_until=NULL');
    else sets.push(`limit_until=DATEADD(DAY, ${d.limitDays}, SYSDATETIMEOFFSET())`);
  }
  if (!sets.length) return res.json({ privacy: privacyView(req.user) });
  const u = await one(`UPDATE users SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE id=$1`, vals);
  res.json({ privacy: privacyView(u) });
}));

async function person(req) {
  const id = uuid.parse(req.params.userId);
  if (id.toLowerCase() === String(req.user.id).toLowerCase()) throw badRequest("That's you");
  const u = await one('SELECT id FROM users WHERE id=$1', [id]);
  if (!u) throw notFound('User not found');
  return u.id;
}
async function status(meId, id) {
  const s = await one(`SELECT
      CASE WHEN EXISTS (SELECT 1 FROM user_restricts WHERE user_id=$1 AND target_id=$2) THEN 1 ELSE 0 END AS restricted,
      (SELECT TOP 1 mute_posts FROM user_mutes WHERE user_id=$1 AND target_id=$2) AS mute_posts,
      (SELECT TOP 1 mute_moments FROM user_mutes WHERE user_id=$1 AND target_id=$2) AS mute_moments,
      CASE WHEN EXISTS (SELECT 1 FROM moment_hidden_from WHERE user_id=$1 AND target_id=$2) THEN 1 ELSE 0 END AS moments_hidden`, [meId, id]);
  return { restricted: !!s.restricted, mutePosts: !!s.mute_posts, muteMoments: !!s.mute_moments, momentsHidden: !!s.moments_hidden };
}

r.get('/people/:userId', ah(async (req, res) => res.json(await status(req.user.id, await person(req)))));

r.put('/people/:userId', ah(async (req, res) => {
  const id = await person(req);
  const d = z.object({ restricted: z.boolean().optional(), mutePosts: z.boolean().optional(), muteMoments: z.boolean().optional(), momentsHidden: z.boolean().optional() }).strict().parse(req.body || {});
  const me = req.user.id;
  const toggle = async (on, table) => {
    if (on) await query(`IF NOT EXISTS (SELECT 1 FROM ${table} WHERE user_id=$1 AND target_id=$2) INSERT INTO ${table} (user_id, target_id) VALUES ($1, $2)`, [me, id]);
    else await query(`DELETE FROM ${table} WHERE user_id=$1 AND target_id=$2`, [me, id]);
  };
  if (d.restricted !== undefined) await toggle(d.restricted, 'user_restricts');
  if (d.momentsHidden !== undefined) await toggle(d.momentsHidden, 'moment_hidden_from');
  if (d.mutePosts !== undefined || d.muteMoments !== undefined) {
    const cur = await status(me, id);
    const posts = d.mutePosts ?? cur.mutePosts; const moments = d.muteMoments ?? cur.muteMoments;
    if (!posts && !moments) await query('DELETE FROM user_mutes WHERE user_id=$1 AND target_id=$2', [me, id]);
    else {
      await query(`IF EXISTS (SELECT 1 FROM user_mutes WHERE user_id=$1 AND target_id=$2)
          UPDATE user_mutes SET mute_posts=$3, mute_moments=$4 WHERE user_id=$1 AND target_id=$2
        ELSE INSERT INTO user_mutes (user_id, target_id, mute_posts, mute_moments) VALUES ($1, $2, $3, $4)`, [me, id, posts ? 1 : 0, moments ? 1 : 0]);
    }
  }
  res.json(await status(me, id));
}));

export default r;
