// Soul DNA v4: your mind model. Each person gets their own set of scenarios (a random mix across every layer, then a
// few aimed at what the model is still unsure about); answers are saved as you go.
//  GET  /soul/dna                 my scenarios + my saved answers
//  PUT  /soul/dna/answers         { answers: { id: option | { o, t?, ms?, ch? } } }  → may add a few more scenarios
//  POST /soul/dna/complete        all my scenarios answered → Soul DNA ready, Soul type
//  POST /soul/dna/retake          Premium: start over (your current Soul DNA stays until you finish the new one)
//  GET  /soul/dna/me              my own Soul DNA (how I think, layers, give and take, spectrum)
//  GET  /soul/compat/:userId      ?relation=… → full predicted compatibility (+ how they think)
//  GET  /soul/pair/:userId        ?intent=… → 0-3 quick scenarios about what Soulink can't judge yet for us two
//  POST /soul/pair/:userId        { answers } → answers merged into my Soul DNA, our score updated
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah, badRequest, forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { meView } from '../services/social.js';
import { soulTypeOf } from '../services/soulQuiz.js';
import { QUESTION_IDS, RELATION_KEYS, SECTIONS, cleanAnswers, compat, corePlan, extendPart, isComplete, pairQuestions, publicQuestions, relationOf, selfView, theirMind, traitsFromAxes } from '../services/soulDna.js';
import { addAnswers, loadDna, relationBetween, saveCompletedDna, scoreFor } from '../services/soulStore.js';
import { pinnedCompat, pinsFor } from '../services/soulPins.js';
import { INTENT_KEYS } from '../services/connections.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const SECTION_OF = Object.fromEntries(publicQuestions(QUESTION_IDS).map((q) => [q.id, q.section]));
const sectionOf = (id) => SECTION_OF[id] || null;
const parse = (v, d = {}) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || 'null') ?? d; } catch { return d; } };

async function myRow(userId) {
  return one('SELECT * FROM soul_dna WHERE user_id=$1', [userId]);
}
/** My personal list of scenarios (made once, then grown a little when the model needs more). */
async function myPlan(userId, row) {
  let plan = parse(row?.scenario_plan, null);
  if (Array.isArray(plan) && plan.length) return plan.filter((id) => QUESTION_IDS.includes(id));
  // tests: everyone gets every scenario, so results are predictable
  plan = config.env === 'test' ? [...QUESTION_IDS] : corePlan(`${userId}:${row?.updated_at ? new Date(row.updated_at).getTime() : 0}`);
  if (row) await query('UPDATE soul_dna SET scenario_plan=$2 WHERE user_id=$1', [userId, JSON.stringify(plan)]);
  else await query("INSERT INTO soul_dna (user_id, answers, scenario_plan) VALUES ($1, N'{}', $2)", [userId, JSON.stringify(plan)]);
  return plan;
}

r.get('/dna', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const plan = await myPlan(req.user.id, row);
  const answers = parse(row?.answers);
  const mine = Object.fromEntries(plan.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]]));
  res.json({ sections: SECTIONS, questions: publicQuestions(plan), answers: mine, answered: Object.keys(mine).length, total: plan.length, completed: !!row?.completed_at, canRetake: !!req.user.is_premium });
}));

// Your first Soul DNA is free. Changing it after it's done (retaking) is Premium.
const retakeLocked = (req, row) => !!row?.completed_at && !req.user.is_premium;
const premiumRetake = () => forbidden('Retaking your Soul DNA is a Premium feature', 'premium_required');

r.post('/dna/retake', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  if (!row?.completed_at) return res.json({ ok: true, fresh: true }); // never finished one: nothing to retake, just take it
  if (retakeLocked(req, row)) throw premiumRetake();
  const plan = config.env === 'test' ? [...QUESTION_IDS] : corePlan(`${req.user.id}:${Date.now()}`); // a fresh mix of scenarios
  await query("UPDATE soul_dna SET answers=N'{}', scenario_plan=$2, updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1", [req.user.id, JSON.stringify(plan)]);
  res.json({ ok: true });
}));

r.put('/dna/answers', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  if (retakeLocked(req, row)) throw premiumRetake();
  const { answers } = z.object({ answers: z.record(z.string(), z.any()) }).parse(req.body);
  const plan = await myPlan(req.user.id, row);
  const clean = cleanAnswers(answers);
  for (const id of Object.keys(answers)) if (!clean[id] && clean[id] !== 0) throw badRequest(`Invalid answer for ${id}`);
  for (const id of Object.keys(clean)) if (!plan.includes(id)) throw badRequest(`${id} is not one of your questions`);
  const merged = { ...parse(row?.answers), ...clean };
  // a part was just finished: if Soul DNA is still unsure about that part, 1-2 more from the SAME part, placed
  // right after it (asked next, never at the end out of order)
  let newPlan = [...plan];
  const added = [];
  const layers = [...new Set(Object.keys(clean).map((id) => sectionOf(id)).filter(Boolean))];
  for (const layer of layers) {
    const more = extendPart(newPlan, merged, layer);
    if (!more.length) continue;
    const last = newPlan.reduce((at, id, n) => (sectionOf(id) === layer ? n : at), newPlan.length - 1);
    newPlan = [...newPlan.slice(0, last + 1), ...more, ...newPlan.slice(last + 1)];
    added.push(...more);
  }
  await query('UPDATE soul_dna SET answers=$2, scenario_plan=$3, updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1', [req.user.id, JSON.stringify(merged), JSON.stringify(newPlan)]);
  res.json({ answered: newPlan.filter((id) => merged[id] !== undefined).length, total: newPlan.length, added: added.length ? publicQuestions(added) : [] });
}));

r.post('/dna/complete', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = parse(row?.answers);
  const plan = await myPlan(req.user.id, row);
  if (!isComplete(answers, plan)) throw badRequest(`Answer every question first (${plan.filter((id) => answers[id] === undefined).length} left)`, 'incomplete');
  const { user, dna, type, tagline } = await saveCompletedDna(req.user.id, answers);
  res.json({ user: meView(user), soul: { type, tagline }, me: selfView(dna) });
}));

r.get('/dna/me', ah(async (req, res) => {
  const m = await loadDna([req.user.id]);
  const dna = m.get(String(req.user.id).toLowerCase());
  if (!dna) return res.json({ ready: false });
  const { type, tagline } = soulTypeOf(traitsFromAxes(dna));
  res.json({ ready: true, type, tagline, me: selfView(dna) });
}));

// Full match picture. Headline scores are free; the breakdown is Premium (free while testing).
r.get('/compat/:userId', ah(async (req, res) => {
  const otherId = uuid.parse(req.params.userId);
  const relation = z.enum(RELATION_KEYS).optional().parse(req.query.relation) || await relationBetween(req.user.id, otherId);
  const pin = (await pinsFor(req.user.id, otherId))[relation];
  const m = await loadDna([req.user.id, otherId]);
  const A = m.get(String(req.user.id).toLowerCase()); const B = m.get(String(otherId).toLowerCase());
  if (pin == null && (!A || !B)) return res.json({ ready: false, mine: !!A, theirs: !!B });
  const full = pin != null ? pinnedCompat(relation, pin) : compat(A, B, relation);
  const unlocked = !!req.user.is_premium || config.premiumFreeTrial;
  res.json({
    ready: true, predicted: true, unlocked,
    ...full,
    them: B ? theirMind(B) : [],
    ...(unlocked ? {} : { dims: [], strengths: [], friction: [], dealbreakers: [], story: [], leads: [], them: [] }),
  });
}));

// ---------- questions asked when connecting ----------
const intentQ = z.object({ intent: z.enum(INTENT_KEYS).optional() });
r.get('/pair/:userId', ah(async (req, res) => {
  const otherId = uuid.parse(req.params.userId);
  const { intent } = intentQ.parse(req.query);
  const relation = intent ? relationOf(intent) : await relationBetween(req.user.id, otherId);
  const m = await loadDna([req.user.id, otherId]);
  const A = m.get(String(req.user.id).toLowerCase()); const B = m.get(String(otherId).toLowerCase());
  if (!A || !B) return res.json({ questions: [] });
  const row = await myRow(req.user.id);
  const ids = pairQuestions(parse(row?.answers), A, B, relation, 3);
  res.json({ relation, questions: publicQuestions(ids) });
}));

r.post('/pair/:userId', ah(async (req, res) => {
  const otherId = uuid.parse(req.params.userId);
  const { answers, intent } = z.object({ answers: z.record(z.string(), z.any()), intent: z.enum(INTENT_KEYS).optional() }).parse(req.body);
  const row = await myRow(req.user.id);
  const have = parse(row?.answers);
  const clean = cleanAnswers(answers);
  const fresh = Object.fromEntries(Object.entries(clean).filter(([id]) => have[id] === undefined).slice(0, 3)); // only new ones, at most 3
  if (!Object.keys(fresh).length) throw badRequest('Nothing new to save', 'no_answers');
  await addAnswers(req.user.id, fresh);
  // any open request between us gets the updated score
  const q = await one(`SELECT TOP 1 * FROM connection_requests WHERE status IN (N'pending', N'held') AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)) ORDER BY created_at DESC`, [req.user.id, otherId]);
  const score = await scoreFor(req.user.id, otherId, q?.intent || intent || 'friendship');
  if (q && score != null) await query('UPDATE connection_requests SET soul_score=$2 WHERE id=$1', [q.id, score]);
  res.json({ ok: true, soulScore: score });
}));

export default r;
