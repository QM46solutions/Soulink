// Soul DNA v5: 7 short games (plus 3 taps about what you want) build your mind model; answers are saved as you go.
//  GET  /soul/dna                 the games + my saved answers
//  PUT  /soul/dna/answers         { answers: { id: answer } }  (shapes per game: see services/mind/scenarios.js)
//  POST /soul/dna/complete        every game played → Soul DNA ready, Soul type
//  POST /soul/dna/retake          Premium: start over (your current Soul DNA stays until you finish the new one).
//                                 Free for anyone whose Soul DNA was made with the old quiz (once, to play the games).
//  GET  /soul/dna/me              my own Soul DNA (how I think, layers, give and take, spectrum)
//  GET  /soul/compat/:userId      ?relation=… → full predicted compatibility (+ how they think)
//  GET  /soul/pair/:userId        ?intent=… → 0-3 quick items about what Soulink can't judge yet for us two
//  POST /soul/pair/:userId        { answers } → answers merged into my Soul DNA, our score updated
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah, badRequest, forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { meView } from '../services/social.js';
import { soulTypeOf } from '../services/soulQuiz.js';
import { CHIPS, DNA_VERSION, QUESTION_IDS, RELATION_KEYS, SECTIONS, answeredCount, cleanAnswers, compat, isComplete, knownAnswers, pairQuestions, planFor, publicQuestions, relationOf, selfView, theirMind, traitsFromAxes } from '../services/soulDna.js';
import { addAnswers, loadDna, relationBetween, saveCompletedDna, scoreFor } from '../services/soulStore.js';
import { pinnedCompat, pinsFor } from '../services/soulPins.js';
import { INTENT_KEYS } from '../services/connections.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const parse = (v, d = {}) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || 'null') ?? d; } catch { return d; } };
const QSET = new Set(QUESTION_IDS);

async function myRow(userId) {
  return one('SELECT * FROM soul_dna WHERE user_id=$1', [userId]);
}
const dnaVersion = (row) => (row?.completed_at ? parse(row.dna, null)?.v ?? null : null);
/** Finished with the games (v5). A Soul DNA from the old quiz counts as "to be upgraded", not finished. */
const doneWithGames = (row) => dnaVersion(row) === DNA_VERSION;
const upgrading = (row) => !!row?.completed_at && dnaVersion(row) !== DNA_VERSION;

r.get('/dna', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = knownAnswers(parse(row?.answers));
  const plan = planFor(answers);
  res.json({
    sections: SECTIONS, chips: CHIPS, questions: publicQuestions(QUESTION_IDS), plan, answers,
    answered: answeredCount(answers, plan), total: plan.length,
    completed: doneWithGames(row), upgrade: upgrading(row), canRetake: !!req.user.is_premium,
  });
}));

// Your first Soul DNA is free. Changing it after it's done (retaking) is Premium — except moving from the old quiz
// to the games, which everyone gets once.
const retakeLocked = (req, row) => doneWithGames(row) && !req.user.is_premium;
const premiumRetake = () => forbidden('Retaking your Soul DNA is a Premium feature', 'premium_required');

r.post('/dna/retake', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  if (!row?.completed_at || upgrading(row)) return res.json({ ok: true, fresh: true }); // nothing to retake: just play
  if (retakeLocked(req, row)) throw premiumRetake();
  await query("UPDATE soul_dna SET answers=N'{}', updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1", [req.user.id]);
  res.json({ ok: true });
}));

r.put('/dna/answers', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  if (retakeLocked(req, row)) throw premiumRetake();
  const { answers } = z.object({ answers: z.record(z.string(), z.any()) }).parse(req.body);
  for (const id of Object.keys(answers)) if (!QSET.has(id)) throw badRequest(`${id} is not one of the games`);
  const clean = cleanAnswers(answers);
  for (const id of Object.keys(answers)) if (clean[id] === undefined) throw badRequest(`Invalid answer for ${id}`);
  const merged = { ...knownAnswers(parse(row?.answers)), ...clean }; // old-quiz answers are dropped once you play
  if (row) await query('UPDATE soul_dna SET answers=$2, updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1', [req.user.id, JSON.stringify(merged)]);
  else await query('INSERT INTO soul_dna (user_id, answers) VALUES ($1, $2)', [req.user.id, JSON.stringify(merged)]);
  const plan = planFor(merged);
  res.json({ answered: answeredCount(merged, plan), total: plan.length, plan, added: [] });
}));

r.post('/dna/complete', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = knownAnswers(parse(row?.answers));
  const plan = planFor(answers);
  if (!isComplete(answers, plan)) throw badRequest(`Play every game first (${plan.filter((id) => answers[id] === undefined).length} left)`, 'incomplete');
  const mine = Object.fromEntries(plan.map((id) => [id, answers[id]])); // only this person's loyalty version counts
  const { user, dna, type, tagline } = await saveCompletedDna(req.user.id, mine);
  res.json({ user: meView(user), soul: { type, tagline }, me: selfView(dna) });
}));

r.get('/dna/me', ah(async (req, res) => {
  const m = await loadDna([req.user.id]);
  const dna = m.get(String(req.user.id).toLowerCase());
  if (!dna) return res.json({ ready: false });
  const { type, tagline } = soulTypeOf(traitsFromAxes(dna));
  res.json({ ready: true, type, tagline, me: selfView(dna), upgrade: dna.v !== DNA_VERSION });
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
  const ids = pairQuestions(knownAnswers(parse(row?.answers)), A, B, relation, 3);
  res.json({ relation, questions: publicQuestions(ids) });
}));

r.post('/pair/:userId', ah(async (req, res) => {
  const otherId = uuid.parse(req.params.userId);
  const { answers, intent } = z.object({ answers: z.record(z.string(), z.any()), intent: z.enum(INTENT_KEYS).optional() }).parse(req.body);
  const row = await myRow(req.user.id);
  const have = knownAnswers(parse(row?.answers));
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
