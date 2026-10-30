import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/errors.js';
import { nearestPlace, placesCredit, searchPlaces } from '../services/places.js';

const r = Router();
r.get('/search', (req, res) => res.json({ places: searchPlaces(String(req.query.q || '')), credit: placesCredit }));
r.get('/near', ah(async (req, res) => {
  const { lat, lon } = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }).parse(req.query);
  res.json({ place: nearestPlace(lat, lon) });
}));
export default r;
