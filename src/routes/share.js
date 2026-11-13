// Sharing a post or a Spark outside Soulink. Anyone with the link (no account needed) sees ONLY that one post:
// its picture / video, the caption and who posted it, for 15 seconds; then the app asks them to log in.
// Only public posts can be previewed (not from private accounts, not anonymous, hidden or scheduled ones).
// The media links in the answer last 2 minutes and open only that post's files.
//  GET /share/post/:id   ·   GET /share/spark/:id
import { Router } from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import { ah, notFound } from '../lib/errors.js';
import { signDeep } from '../lib/fileLinks.js';

const r = Router();
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
export const PREVIEW_SECONDS = 15;
const GUEST_TTL = 120; // seconds the preview's media links work
const list = (v) => { if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]') || []; } catch { return []; } };
const author = (x) => ({ username: x.username, displayName: x.display_name || x.username, avatarUrl: x.avatar_url || null, verified: !!x.face_verified });
const PUBLIC_AUTHOR = 'u.is_private = 0 AND u.deactivated_at IS NULL AND u.onboarding_done = 1';
const gone = () => notFound('This post is not available. Log in to Soulink to see more.', 'not_shareable');

r.get('/post/:id', ah(async (req, res) => {
  const x = await one(`SELECT p.id, p.caption, p.media_urls, p.created_at, u.username, u.display_name, u.avatar_url, u.face_verified
      FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.id = $1 AND p.deleted_at IS NULL AND p.suspended_at IS NULL AND ISNULL(p.is_anonymous, 0) = 0
       AND (p.reveal_at IS NULL OR p.reveal_at <= SYSDATETIMEOFFSET()) AND ${PUBLIC_AUTHOR}`, [uuid.parse(req.params.id)]);
  if (!x) throw gone();
  res.json(signDeep({ kind: 'post', id: x.id, caption: x.caption || '', media: list(x.media_urls), createdAt: x.created_at, author: author(x), previewSeconds: PREVIEW_SECONDS }, 'g', GUEST_TTL));
}));

r.get('/spark/:id', ah(async (req, res) => {
  const x = await one(`SELECT s.id, s.caption, s.video_url, s.is_voice, s.category, s.mic_topic, s.created_at, u.username, u.display_name, u.avatar_url, u.face_verified
      FROM sparks s JOIN users u ON u.id = s.author_id
     WHERE s.id = $1 AND s.deleted_at IS NULL AND s.suspended_at IS NULL AND ${PUBLIC_AUTHOR}`, [uuid.parse(req.params.id)]);
  if (!x) throw gone();
  res.json(signDeep({ kind: 'spark', id: x.id, caption: x.caption || '', videoUrl: x.video_url, voice: !!x.is_voice, category: x.category, micTopic: x.mic_topic || null,
    createdAt: x.created_at, author: author(x), previewSeconds: PREVIEW_SECONDS }, 'g', GUEST_TTL));
}));

export default r;
