// Soul DNA v7: 8 categories of short activities. An 11-activity first session builds your Soul DNA; after that,
// optional check-ins (3 new activities) and per-category updates refine it, free, any time.
//  GET  /soul/dna                    the activities + my first-session plan + my saved answers
//  PUT  /soul/dna/answers            { answers: { id: answer } }  (shapes per kind: services/mind/scenarios.js).
//                                    Before the first session is done: saved. After: merged and Soul DNA rebuilt.
//  POST /soul/dna/complete           first session played → Soul DNA ready, Soul type
//  GET  /soul/dna/checkin            ?category=… → 3 activities to refine Soul DNA (one category: its activities)
//  POST /soul/dna/retake             Premium: start over (your current Soul DNA stays until you finish the new one).
//                                    Free for anyone whose Soul DNA was made with the old quiz.
//  GET  /soul/dna/me                 my own Soul DNA (tendencies per category with how sure, how I think, spectrum)
//  GET  /soul/compat/:userId         ?relation=… → full predicted compatibility (+ how they think)
//  GET  /soul/pair/:userId           ?intent=… → 0-3 quick items about what Soulink can't judge yet for us two
//  POST /soul/pair/:userId           { answers } → answers merged into my Soul DNA, our score updated
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah, badRequest, forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { meView } from '../services/social.js';
import { soulTypeOf } from '../services/soulQuiz.js';
import { QUESTION_IDS, RELATION_KEYS, SECTIONS, answeredCount, checkinPlan, cleanAnswers, compat, isComplete, knownAnswers, pairQuestions, planFor, publicQuestions, relationOf, selfView, theirMind, traitsFromAxes } from '../services/soulDna.js';
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
/** Finished: a Soul DNA made with the v6 games or the v7 activities. One from the old quiz (v4 / v5) is "to be
 *  upgraded": its owner plays the first session. A v6 one keeps working; its owner is invited to refresh it. */
const doneWithGames = (row) => dnaVersion(row) >= 6;
const upgrading = (row) => !!row?.completed_at && dnaVersion(row) < 6;
const seedOf = (req) => String(req.user.id).toLowerCase();

r.get('/dna', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = knownAnswers(parse(row?.answers));
  const plan = planFor(seedOf(req));
  res.json({
    sections: SECTIONS, questions: publicQuestions(QUESTION_IDS), plan, answers,
    answered: answeredCount(answers, plan), total: plan.length,
    completed: doneWithGames(row), upgrade: upgrading(row), refresh: dnaVersion(row) === 6, retaking: !!parse(row?.answers).__retake, canRetake: !!req.user.is_premium,
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
  // __retake: answers now go into the new first session; the current Soul DNA stays until it's finished
  await query(`UPDATE soul_dna SET answers=N'{"__retake":1}', updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1`, [req.user.id]);
  res.json({ ok: true });
}));

r.put('/dna/answers', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const { answers } = z.object({ answers: z.record(z.string(), z.any()) }).parse(req.body);
  for (const id of Object.keys(answers)) if (!QSET.has(id)) throw badRequest(`${id} is not one of the activities`);
  const clean = cleanAnswers(answers);
  for (const id of Object.keys(answers)) if (clean[id] === undefined) throw badRequest(`Invalid answer for ${id}`);
  const plan = planFor(seedOf(req));
  // Soul DNA done: a check-in or an update (free, any time): merged in and rebuilt straight away
  if (doneWithGames(row) && !parse(row?.answers).__retake) {
    const { dna } = await addAnswers(req.user.id, clean);
    const merged = { ...knownAnswers(parse(row?.answers)), ...clean };
    return res.json({ answered: answeredCount(merged, plan), total: plan.length, plan, updated: true, me: selfView(dna) });
  }
  const merged = { ...knownAnswers(parse(row?.answers)), ...(parse(row?.answers).__retake ? { __retake: 1 } : {}), ...clean }; // old-quiz answers are dropped once you play
  if (row) await query('UPDATE soul_dna SET answers=$2, updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1', [req.user.id, JSON.stringify(merged)]);
  else await query('INSERT INTO soul_dna (user_id, answers) VALUES ($1, $2)', [req.user.id, JSON.stringify(merged)]);
  res.json({ answered: answeredCount(merged, plan), total: plan.length, plan });
}));

// a check-in: 3 activities you haven't done, from the categories Soul DNA is least sure about; or one category's
// activities (its "Not quite" / Update answers)
r.get('/dna/checkin', ah(async (req, res) => {
  const { category } = z.object({ category: z.enum(SECTIONS.map((x) => x.key)).optional() }).parse(req.query);
  const row = await myRow(req.user.id);
  const answers = knownAnswers(parse(row?.answers));
  const m = await loadDna([req.user.id]);
  const dna = m.get(seedOf(req)) || null;
  // a v6 Soul DNA refreshing for the first time gets the new first session
  const fresh = dna && dna.v === 6 && !category ? planFor(seedOf(req)).filter((id) => answers[id] === undefined) : null;
  const ids = fresh?.length ? fresh : checkinPlan(dna, answers, 3, category || null);
  res.json({ ids, questions: publicQuestions(ids), answers: Object.fromEntries(ids.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]])) });
}));

r.post('/dna/complete', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = knownAnswers(parse(row?.answers));
  const plan = planFor(seedOf(req));
  if (!isComplete(answers, plan)) throw badRequest(`Finish the activities first (${plan.filter((id) => answers[id] === undefined).length} left)`, 'incomplete');
  const { user, dna, type, tagline } = await saveCompletedDna(req.user.id, answers, null); // a fresh first session
  res.json({ user: meView(user), soul: { type, tagline }, me: selfView(dna) });
}));

r.get('/dna/me', ah(async (req, res) => {
  const m = await loadDna([req.user.id]);
  const dna = m.get(seedOf(req));
  if (!dna) return res.json({ ready: false });
  const { type, tagline } = soulTypeOf(traitsFromAxes(dna));
  res.json({ ready: true, type, tagline, me: selfView(dna), upgrade: dna.v < 6, refresh: dna.v === 6, version: dna.v });
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
