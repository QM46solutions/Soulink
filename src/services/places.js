// Offline India place search + "where am I" (no paid map service needed).
// Data: GeoNames (CC BY 4.0) via all-the-cities, plus curated Hyderabad areas. See data/places-in.json.
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../../data/places-in.json', import.meta.url), 'utf8'));
const HYD = { lat: 17.385, lon: 78.4867 };
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');
const km = (a, b) => {
  const dLat = (b.lat - a.lat) * 111;
  const dLon = (b.lon - a.lon) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
};
const label = (p) => {
  if (p.l) return { label: `${p.n}, Hyderabad`, sub: 'Telangana' };
  if (p.s === 'Telangana' && p.n !== 'Hyderabad' && km(p, HYD) < 30) return { label: `${p.n}, Hyderabad`, sub: 'Telangana' };
  return { label: p.n, sub: p.s };
};
const all = [
  ...data.localities.map((p) => ({ ...p, key: norm(p.n), rank: 1e9 })),
  ...data.places.map((p) => ({ ...p, key: norm(p.n), rank: p.p })),
  // common other names people type: Bangalore, Vizag, Bombay...
  ...data.places.filter((p) => p.a).map((p) => ({ ...p, key: norm(p.a), rank: p.p })),
];

/** Typing suggestions: names that start with (or have a word starting with) what was typed. */
export function searchPlaces(q, limit = 8) {
  const k = norm(q).trim();
  if (k.length < 2) return [];
  const starts = [];
  const words = [];
  for (const p of all) {
    if (p.key.startsWith(k)) starts.push(p);
    else if (p.key.includes(` ${k}`)) words.push(p);
  }
  const seen = new Set();
  return [...starts.sort((a, b) => b.rank - a.rank), ...words.sort((a, b) => b.rank - a.rank)]
    .map(label).filter((x) => (seen.has(x.label) ? false : seen.add(x.label))).slice(0, limit);
}

/** Current position → nearest Hyderabad area (within 4 km) or nearest town/city. */
export function nearestPlace(lat, lon) {
  const here = { lat, lon };
  let best = null;
  for (const p of data.localities) { const d = km(here, p); if (d < 4 && (!best || d < best.d)) best = { p, d }; }
  if (!best) for (const p of data.places) { const d = km(here, p); if (!best || d < best.d) best = { p, d }; }
  if (!best || best.d > 60) return null;
  return { ...label(best.p), km: Math.round(best.d * 10) / 10 };
}

/** A typed or picked city label ("Kondapur, Hyderabad") → area coordinates, or null. */
export function placeCoords(labelText) {
  if (!labelText) return null;
  const parts = String(labelText).split(',').map((x) => norm(x).trim()).filter(Boolean);
  for (const k of parts) {
    const loc = data.localities.find((p) => norm(p.n) === k);
    if (loc) return { lat: loc.lat, lon: loc.lon };
    let best = null;
    for (const p of data.places) if ((norm(p.n) === k || (p.a && norm(p.a) === k)) && (!best || p.p > best.p)) best = p;
    if (best) return { lat: best.lat, lon: best.lon };
  }
  return null;
}
export const distanceKm = km;

export const placesCredit = data.source;
