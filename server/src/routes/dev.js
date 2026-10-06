// Laptop-only test helpers. Never available in production, and refused for anything coming through
// the phone link or the network: only requests made directly on this laptop are accepted.
import { Router } from 'express';
import { many, one, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, forbidden } from '../lib/errors.js';
import { signToken } from '../lib/auth.js';
import { sampleAnswers } from '../services/soulDna.js';
import { saveCompletedDna } from '../services/soulStore.js';
import { meView } from '../services/social.js';
import { saveFile } from '../providers/storage.js';
import { cartoonFacePng } from '../services/cartoonFace.js';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use((req, res, next) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!config.isDev || !local || req.headers['x-forwarded-host']) return next(forbidden('Test helpers only work on the laptop'));
  return next();
});

const DEMO = [
  { look: { skin: '#e2a878', hair: '#1b1410' }, phone: '+919000000100', username: 'sai.demo', name: 'Sai Demo', city: 'Kondapur, Hyderabad', bio: 'Founder mode. Chai > coffee.', interests: ['Startups', 'Tech', 'Cricket', 'Food'], k: 0 },
  { look: { skin: '#f0c29b', hair: '#3b2314', bg: '#3a1f3f' }, phone: '+919000000101', username: 'ananya.r', name: 'Ananya Reddy', city: 'Gachibowli, Hyderabad', bio: 'Designer. Sunsets and sketchbooks.', interests: ['Art', 'Travel', 'Photography'], k: 0 },
  { look: { skin: '#c98b5e', hair: '#111111' }, phone: '+919000000102', username: 'rahul.k', name: 'Rahul Kumar', city: 'Madhapur, Hyderabad', bio: 'Code by day, cricket by night.', interests: ['Cricket', 'Tech', 'Gaming'], k: 1 },
  { look: { skin: '#e8b996', hair: '#5a2e1a', bg: '#3f1f2f' }, phone: '+919000000103', username: 'priya.s', name: 'Priya Sharma', city: 'Banjara Hills, Hyderabad', bio: 'Books, biryani and bad puns.', interests: ['Books', 'Food', 'Movies'], k: 13 },
  { look: { skin: '#b97f55', hair: '#222222', bg: '#1f2a40' }, phone: '+919000000104', username: 'arjun.v', name: 'Arjun Varma', city: 'Jubilee Hills, Hyderabad', bio: 'Gym, gigs, repeat.', interests: ['Fitness', 'Music', 'Travel'], k: 7 },
  { look: { skin: '#d9a07a', hair: '#2b1a10', bg: '#1f3a35' }, phone: '+919000000105', username: 'meera.n', name: 'Meera Nair', city: 'Kukatpally, Hyderabad', bio: 'Dancer. Plant mom. 2 am philosopher.', interests: ['Dance', 'Spirituality', 'Music'], k: 21 },
];

// Creates (or refreshes) 6 fully set-up demo accounts and logs you in as @sai.demo
r.post('/demo', ah(async (req, res) => {
  const ids = {};
  for (const d of DEMO) {
    const user = await tx(async (c) => {
      let u = (await c.query('SELECT * FROM users WHERE phone=$1', [d.phone])).rows[0];
      if (!u) u = (await c.query('INSERT INTO users (phone) OUTPUT INSERTED.* VALUES ($1)', [d.phone])).rows[0];
      await c.query(
        `UPDATE users SET username=$2, display_name=$3, city=$4, bio=$5, interests=$6, birth_date='1999-06-15',
                face_verified=1, onboarding_done=1, updated_at=SYSDATETIMEOFFSET() WHERE id=$1`,
        [u.id, d.username, d.name, d.city, d.bio, JSON.stringify(d.interests)],
      );
      if (!u.avatar_url) {
        const url = await saveFile({ buffer: cartoonFacePng(d.look), mimetype: 'image/png' }, 'avatars');
        await c.query('UPDATE users SET avatar_url=$2 WHERE id=$1', [u.id, url]);
      }
      return u;
    });
    await saveCompletedDna(user.id, sampleAnswers(d.k));
    ids[d.username] = user.id;
  }
  // @sai.demo follows two people; one follows back
  const follow = async (a, b) => query(`IF NOT EXISTS (SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2) INSERT INTO follows (follower_id, followee_id, status) VALUES ($1, $2, N'accepted')`, [ids[a], ids[b]]);
  await follow('sai.demo', 'ananya.r'); await follow('sai.demo', 'rahul.k'); await follow('ananya.r', 'sai.demo');
  const me = await one('SELECT * FROM users WHERE id=$1', [ids['sai.demo']]);
  res.json({ token: signToken(me.id), user: meView(me), demoUsers: DEMO.map((d) => ({ username: d.username, name: d.name, phone: d.phone.slice(3) })) });
}));

// Soulmoji tuning (laptop only): render moods for the signed-in user's own Soulmoji selfie with test recipes.
// POST /dev/soulmoji-preview { recipes: { name: { smile: 1, ... } } } -> { files: { name: "/uploads/soulmoji-preview/name.jpg" } }
r.post('/soulmoji-preview', requireAuth, ah(async (req, res) => {
  const { aiEdit } = await import('../services/soulmojiAi.js');
  const src = req.user.soulmoji_src_url;
  if (!src) return res.status(400).json({ error: { message: 'Take a Soulmoji selfie first' } });
  const dir = path.join(config.uploadDir, 'soulmoji-preview');
  await fsp.mkdir(dir, { recursive: true });
  const files = {}; const errors = {};
  for (const [name, recipe] of Object.entries(req.body?.recipes || {})) {
    const safe = name.replace(/[^a-z0-9_-]/gi, '');
    try { await aiEdit(path.join(config.uploadDir, src.replace(/^\/uploads\//, '')), path.join(dir, `${safe}.jpg`), safe, recipe); files[safe] = `/uploads/soulmoji-preview/${safe}.jpg`; } catch (e) { errors[safe] = e.message; }
  }
  res.json({ files, errors, src });
}));

export default r;
