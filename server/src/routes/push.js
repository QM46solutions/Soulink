// Phone notifications: the app asks for the public key, then saves this phone's push subscription.
//  GET    /push/key         -> { publicKey } (null if push isn't available on this server)
//  POST   /push/subscribe   { endpoint, keys: { p256dh, auth } }
//  DELETE /push/subscribe   { endpoint }
//  POST   /push/test        sends "Notifications are on" to all your phones
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { publicKey, pushTo } from '../services/push.js';

const r = Router();

// The browser replaced a phone's push address (sent by the service worker, which has no login): the new address
// takes over from the old one, for the same person. Knowing the old address (a long secret URL) is the proof.
const sub0 = z.object({ endpoint: z.string().url().max(800), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }) });
r.post('/renew', ah(async (req, res) => {
  const d = sub0.extend({ oldEndpoint: z.string().url().max(800) }).parse(req.body || {});
  const old = await one('SELECT user_id FROM push_subscriptions WHERE endpoint=$1', [d.oldEndpoint]);
  if (!old) return res.json({ ok: false });
  await query('DELETE FROM push_subscriptions WHERE endpoint=$1', [d.oldEndpoint]);
  await query(
    `IF EXISTS (SELECT 1 FROM push_subscriptions WHERE endpoint=$1)
       UPDATE push_subscriptions SET user_id=$2, p256dh=$3, auth=$4 WHERE endpoint=$1
     ELSE INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1, $2, $3, $4)`,
    [d.endpoint, old.user_id, d.keys.p256dh, d.keys.auth],
  );
  console.log(`push: phone address renewed -> ${new URL(d.endpoint).host}`);
  res.json({ ok: true });
}));

r.use(requireAuth);

r.get('/key', ah(async (req, res) => res.json({ publicKey: await publicKey() })));

const sub = z.object({ endpoint: z.string().url().max(800), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }) });
r.post('/subscribe', ah(async (req, res) => {
  const s = sub.parse(req.body);
  await query(
    `IF EXISTS (SELECT 1 FROM push_subscriptions WHERE endpoint=$1)
       UPDATE push_subscriptions SET user_id=$2, p256dh=$3, auth=$4 WHERE endpoint=$1
     ELSE INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1, $2, $3, $4)`,
    [s.endpoint, req.user.id, s.keys.p256dh, s.keys.auth],
  );
  console.log(`push: phone subscribed -> ${new URL(s.endpoint).host}`);
  res.status(201).json({ ok: true });
}));

r.delete('/subscribe', ah(async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(800) }).parse(req.body || {});
  await query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [endpoint, req.user.id]);
  res.json({ ok: true });
}));

r.post('/test', ah(async (req, res) => {
  await pushTo(req.user.id, 'requests', { title: 'Soulink', body: 'Notifications are on 🔔 You will hear from your souls here.', url: '/settings', tag: 'test' });
  res.json({ ok: true });
}));

export default r;
