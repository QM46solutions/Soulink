// GET /app/version — the Update App policy for the phone apps (no login needed: also read before signing in).
// { android: { latest, minimum, storeUrl, package }, ios: { latest, minimum, storeUrl|null }, message, mandatory }
import { Router } from 'express';
import { ah } from '../lib/errors.js';
import { publicPolicy } from '../services/appUpdate.js';

const r = Router();
r.get('/version', ah(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await publicPolicy());
}));

export default r;
