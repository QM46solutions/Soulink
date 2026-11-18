// Privacy rules, modelled on Instagram's settings:
//  - Comments: who can comment (everyone / connections / off); Limit interactions (non-Connections can't comment or
//    send Connect requests until a date); Hidden words (offensive words and your own list) and Restrict: such
//    comments are saved but hidden, so only their writer sees them (they aren't told).
//  - Connect requests: from everyone, only strong matches (Soul Score 70%+), or nobody.
//  - Moments: replies on/off; hide your Moments from chosen people; mute someone's Moments or posts.
//  - Activity status and read receipts are two-way: turn yours off and you don't see other people's either.
import { many, one } from '../db.js';
import { forbidden } from '../lib/errors.js';
import { connectionBetween } from './connections.js';

export const COMMENT_WHO = ['everyone', 'connections', 'off'];
export const CONNECT_WHO = ['everyone', 'matches', 'off'];
export const MATCH_MIN = 70;
export const LIMIT_DAYS = [1, 7, 30];

const on = (v) => v === true || v === 1;
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const limited = (u) => !!u?.limit_until && new Date(u.limit_until).getTime() > Date.now();
export const showsActivity = (u) => u?.show_activity === undefined || u?.show_activity === null || on(u.show_activity);
export const sendsReceipts = (u) => u?.read_receipts === undefined || u?.read_receipts === null || on(u.read_receipts);

// Common abuse in English and romanised Hindi / Telugu. Matched as whole words, ignoring case.
// (Kept short on purpose; people add their own words in Settings › Hidden words.)
const OFFENSIVE = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'bitch', 'bastard', 'slut', 'whore', 'cunt', 'asshole', 'retard', 'nigger', 'faggot',
  'madarchod', 'behenchod', 'bhenchod', 'chutiya', 'chutiye', 'gandu', 'randi', 'harami', 'bhosdike', 'lavda', 'lauda',
  'lanja', 'lanjakoduku', 'pooku', 'modda', 'dengey',
];
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const parseWords = (s) => String(s || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 100);
function hasWord(text, words) {
  const t = String(text || '').toLowerCase();
  return words.some((w) => w && new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}($|[^\\p{L}\\p{N}])`, 'u').test(t));
}
/** Would this owner's filters hide this text? */
export function hiddenByWords(owner, text) {
  if (on(owner?.hide_offensive ?? 1) && hasWord(text, OFFENSIVE)) return true;
  return hasWord(text, parseWords(owner?.hidden_words));
}

export async function restricts(ownerId, otherId) {
  return !!(await one('SELECT TOP 1 1 AS x FROM user_restricts WHERE user_id=$1 AND target_id=$2', [ownerId, otherId]));
}

/**
 * May `writer` comment on content owned by `owner`? Throws when not allowed.
 * Returns { hide: true } when the comment is allowed but only its writer should see it (Restrict / Hidden words).
 */
export async function commentGate(owner, writer, text) {
  if (same(owner.id, writer.id)) return { hide: false };
  const who = owner.comment_who || 'everyone';
  if (who === 'off') throw forbidden(`${owner.display_name || owner.username} has turned off comments.`, 'comments_limited');
  const needsConnection = who === 'connections' || limited(owner);
  if (needsConnection && !(await connectionBetween(owner.id, writer.id))) {
    throw forbidden(limited(owner) ? `${owner.display_name || owner.username} is limiting comments from people who aren't Connections right now.`
      : `Only ${owner.display_name || owner.username}'s Connections can comment.`, 'comments_limited');
  }
  if (await restricts(owner.id, writer.id)) return { hide: true };
  return { hide: hiddenByWords(owner, text) };
}

/** May someone send a Connect request to `to`? (score: their Soul Score, 0-100, or null; knows: "we know each other",
 *  which the "strong matches only" choice doesn't block, so friends and family can still connect) */
export function connectGate(to, score, knows = false) {
  const who = to.connect_who || 'everyone';
  const name = to.display_name || to.username;
  if (who === 'off') throw forbidden(`${name} isn't taking Connect requests right now.`, 'connect_closed');
  if (limited(to)) throw forbidden(`${name} isn't taking new Connect requests right now. Try again in a few days.`, 'connect_limited');
  if (who === 'matches' && !knows && !(Number(score) >= MATCH_MIN)) throw forbidden(`${name} only takes Connect requests from strong matches (Soul Score ${MATCH_MIN}% or more).`, 'connect_matches_only');
}

/** SQL: hide posts by people I muted, and posts I marked "Not interested" ($1 = viewer, p = posts). */
export const NOT_MUTED_OR_HIDDEN = `NOT EXISTS (SELECT 1 FROM user_mutes mu WHERE mu.user_id = $1 AND mu.target_id = p.author_id AND mu.mute_posts = 1)
  AND NOT EXISTS (SELECT 1 FROM hidden_posts hp WHERE hp.user_id = $1 AND hp.post_id = p.id)`;
/** SQL: Moments the viewer may see in the tray ($1 = viewer, m = moments). */
export const MOMENT_VISIBLE = `NOT EXISTS (SELECT 1 FROM moment_hidden_from mh WHERE mh.user_id = m.author_id AND mh.target_id = $1)
  AND NOT EXISTS (SELECT 1 FROM user_mutes mu WHERE mu.user_id = $1 AND mu.target_id = m.author_id AND mu.mute_moments = 1)`;

export async function hidesMomentsFrom(authorId, viewerId) {
  return !!(await one('SELECT TOP 1 1 AS x FROM moment_hidden_from WHERE user_id=$1 AND target_id=$2', [authorId, viewerId]));
}

/** My privacy settings, for the app. */
export function privacyView(u) {
  return {
    commentWho: u.comment_who || 'everyone',
    connectWho: u.connect_who || 'everyone',
    momentReplies: u.moment_replies === undefined || u.moment_replies === null ? true : on(u.moment_replies),
    showActivity: showsActivity(u),
    readReceipts: sendsReceipts(u),
    hideOffensive: u.hide_offensive === undefined || u.hide_offensive === null ? true : on(u.hide_offensive),
    hiddenWords: parseWords(u.hidden_words),
    limitUntil: limited(u) ? u.limit_until : null,
  };
}

/** People on one of my lists (restricted / muted / hidden from my Moments), as user rows. */
export async function listPeople(meId, list) {
  const sql = {
    restricted: 'SELECT u.*, x.created_at AS listed_at FROM user_restricts x JOIN users u ON u.id = x.target_id WHERE x.user_id = $1',
    muted: 'SELECT u.*, x.created_at AS listed_at, x.mute_posts, x.mute_moments FROM user_mutes x JOIN users u ON u.id = x.target_id WHERE x.user_id = $1',
    momentsHidden: 'SELECT u.*, x.created_at AS listed_at FROM moment_hidden_from x JOIN users u ON u.id = x.target_id WHERE x.user_id = $1',
  }[list];
  return many(`${sql} ORDER BY x.created_at DESC`, [meId]);
}
