// Soul DNA: the quiz, saving the result, and your own Soul type.
import { Router } from 'express';
import { z } from 'zod';
import { tx } from '../db.js';
import { ah, badRequest } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { QUIZ, TRAITS, publicQuiz, scoreQuiz } from '../services/soulQuiz.js';
import { meView } from '../services/social.js';

const r = Router();
r.use(requireAuth);

r.get('/quiz', (req, res) => res.json({ questions: publicQuiz() }));

r.post('/quiz', ah(async (req, res) => {
  const { answers } = z.object({
    answers: z.array(z.object({ questionId: z.number().int(), optionIndex: z.number().int().min(0).max(3) })).length(QUIZ.length),
  }).parse(req.body);
  if (new Set(answers.map((a) => a.questionId)).size !== QUIZ.length) throw badRequest('Answer every question once');
  const { traits, type, tagline } = scoreQuiz(answers);
  const user = await tx(async (c) => {
    await c.query('DELETE FROM soul_profiles WHERE user_id=$1', [req.user.id]);
    await c.query(
      `INSERT INTO soul_profiles (user_id, ${TRAITS.join(', ')}, summary, confidence, quiz_answers)
       VALUES ($1, ${TRAITS.map((_, i) => `$${i + 2}`).join(', ')}, $10, $11, $12)`,
      [req.user.id, ...TRAITS.map((t) => traits[t]), tagline, 30, JSON.stringify(answers)],
    );
    return (await c.query(
      'UPDATE users SET soul_ready = 1, soul_type = $2, updated_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1',
      [req.user.id, type],
    )).rows[0];
  });
  // Free users see their type + tagline; trait numbers stay hidden (Premium)
  res.json({ user: meView(user), soul: { type, tagline } });
}));

export default r;
