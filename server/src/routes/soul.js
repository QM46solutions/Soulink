// Soul DNA v2: one quiz in sections (progress saved as you go), your own DNA, match details, and check-ins.
//  GET  /soul/dna                 questions + sections + my saved answers
//  PUT  /soul/dna/answers         { answers: { questionId: value } }  (merge, any number at a time)
//  POST /soul/dna/complete        all answered → Soul DNA ready, Soul type
//  POST /soul/dna/retake          Premium: start over (your current Soul DNA stays until you finish the new one)
//  GET  /soul/dna/me              my own Soul DNA (dimensions, spectrum, strengths, tensions)
//  GET  /soul/compat/:userId      ?relation=dating|friendship|business|buddy → full predicted compatibility
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah, badRequest, forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { meView } from '../services/social.js';
import { soulTypeOf } from '../services/soulQuiz.js';
import { QUESTIONS, QUESTION_IDS, RELATION_KEYS, SECTIONS, compat, publicQuestions, selfView, traitsFromAxes, validAnswer } from '../services/soulDna.js';
import { loadDna, relationBetween, saveCompletedDna } from '../services/soulStore.js';
import { pinnedCompat, pinsFor } from '../services/soulPins.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const parse = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}'); } catch { return {}; } };
const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

async function myRow(userId) {
  return one('SELECT * FROM soul_dna WHERE user_id=$1', [userId]);
}

r.get('/dna', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = parse(row?.answers);
  res.json({ sections: SECTIONS, questions: publicQuestions(), answers, answered: Object.keys(answers).filter((k) => QMAP[k]).length, total: QUESTIONS.length, completed: !!row?.completed_at, canRetake: !!req.user.is_premium });
}));

// Your first Soul DNA is free. Changing it after it's done (retaking) is Premium.
const retakeLocked = (req, row) => !!row?.completed_at && !req.user.is_premium;
const premiumRetake = () => forbidden('Retaking your Soul DNA is a Premium feature', 'premium_required');

r.post('/dna/retake', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  if (!row?.completed_at) return res.json({ ok: true, fresh: true }); // never finished one: nothing to retake, just take it
  if (retakeLocked(req, row)) throw premiumRetake();
  await query("UPDATE soul_dna SET answers=N'{}', updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1", [req.user.id]);
  res.json({ ok: true });
}));

r.put('/dna/answers', ah(async (req, res) => {
  if (retakeLocked(req, await myRow(req.user.id))) throw premiumRetake();
  const { answers } = z.object({ answers: z.record(z.string(), z.any()) }).parse(req.body);
  for (const [id, v] of Object.entries(answers)) if (!validAnswer(QMAP[id], v)) throw badRequest(`Invalid answer for question ${id}`);
  const row = await myRow(req.user.id);
  const merged = { ...parse(row?.answers), ...answers };
  if (row) await query('UPDATE soul_dna SET answers=$2, updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1', [req.user.id, JSON.stringify(merged)]);
  else await query('INSERT INTO soul_dna (user_id, answers) VALUES ($1, $2)', [req.user.id, JSON.stringify(merged)]);
  res.json({ answered: Object.keys(merged).filter((k) => QMAP[k]).length, total: QUESTIONS.length });
}));

r.post('/dna/complete', ah(async (req, res) => {
  const row = await myRow(req.user.id);
  const answers = parse(row?.answers);
  const missing = QUESTION_IDS.filter((id) => !validAnswer(QMAP[id], answers[id]));
  if (missing.length) throw badRequest(`Answer every question first (${missing.length} left)`, 'incomplete');
  const { user, dna, type, tagline } = await saveCompletedDna(req.user.id, answers);
  res.json({ user: meView(user), soul: { type, tagline }, me: selfView(dna) });
}));

r.get('/dna/me', ah(async (req, res) => {
  const m = await loadDna([req.user.id]);
  const dna = m.get(String(req.user.id).toLowerCase());
  if (!dna) return res.json({ ready: false });
  const { type, tagline } = soulTypeOf(traitsFromAxes(dna.axes));
  res.json({ ready: true, type, tagline, me: selfView(dna) });
}));

// Full match picture. Headline scores are free; the dimension breakdown is Premium (free while testing).
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
    ...(unlocked ? {} : { dims: [], strengths: [], friction: [], dealbreakers: [] }),
  });
}));

export default r;
