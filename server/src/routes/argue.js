// Argue / Referee. Two modes:
//  phone  - everyone is together; the phone is passed around and each person gives their side in turn.
//  invite - pick connections; everyone gives their side on their own phone at the same time.
// When every side is in, the Referee (Claude, or the free basic judge) gives the verdict.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { notify, userCard } from '../services/social.js';
import { connectionBetween } from '../services/connections.js';
import { judge } from '../services/referee.js';
import { wakeRemoteAi } from '../services/soulmojiAi.js';
import { emitToUsers } from '../realtime.js';

const r = Router();
r.use(requireAuth);

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const nameOf = (u) => u.display_name || u.username;

async function load(id, me) {
  const c = await one('SELECT * FROM argue_cases WHERE id=$1', [uuid.parse(id)]);
  if (!c) throw notFound('Argument not found');
  const people = await many(
    `SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
       FROM argue_participants p LEFT JOIN users u ON u.id = p.user_id WHERE p.case_id=$1 ORDER BY p.seat`, [c.id],
  );
  const mine = people.find((p) => p.user_id === me);
  if (c.created_by !== me && !mine) throw notFound('Argument not found');
  return { c, people, mine };
}

function view({ c, people, mine }, me) {
  const decided = c.status === 'decided';
  return {
    id: c.id,
    mode: c.mode,
    topic: c.topic,
    status: c.status,
    judge: c.judge,
    isCreator: c.created_by === me,
    mySeat: mine?.seat ?? null,
    createdAt: c.created_at,
    decidedAt: c.decided_at,
    people: people.map((p) => ({
      seat: p.seat,
      name: p.name,
      user: p.user_id ? userCard({ id: p.user_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, is_private: p.is_private, face_verified: p.face_verified, soul_type: p.soul_type }) : null,
      submitted: !!p.submitted_at,
      // Sides stay private until the verdict (so nobody can copy or react to another side). You always see your own.
      statement: decided || p.user_id === me ? p.statement : null,
    })),
    verdict: decided ? (typeof c.verdict === 'string' ? JSON.parse(c.verdict) : c.verdict) : null,
  };
}

const userIds = (people) => [...new Set(people.map((p) => p.user_id).filter(Boolean))];

// Start an argument
r.post('/', requireSoul, ah(async (req, res) => {
  const data = z.object({
    mode: z.enum(['phone', 'invite']),
    count: z.number().int().min(2).max(6),
    topic: z.string().trim().max(150).optional(),
    names: z.array(z.string().trim().min(1).max(50)).optional(),          // phone mode: everyone's name, in speaking order
    inviteUserIds: z.array(uuid).optional(),                               // invite mode: the other people
  }).parse(req.body);
  const me = req.user;
  let seats;
  if (data.mode === 'phone') {
    const names = data.names || [];
    if (names.length !== data.count) throw badRequest(`Enter ${data.count} names`);
    seats = names.map((n, i) => ({ seat: i + 1, name: n, userId: i === 0 ? me.id : null }));
  } else {
    const ids = [...new Set((data.inviteUserIds || []).map((x) => x.toUpperCase()))].filter((x) => x !== String(me.id).toUpperCase());
    if (ids.length !== data.count - 1) throw badRequest(`Pick ${data.count - 1} ${data.count - 1 === 1 ? 'person' : 'people'} to invite`);
    const users = [];
    for (const id of ids) {
      const u = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done=1', [id]);
      if (!u) throw badRequest('Some of those people could not be found');
      if (config.connectRequired && !(await connectionBetween(me.id, u.id))) throw forbidden('You can only invite people you are connected with.', 'not_connected');
      users.push(u);
    }
    seats = [{ seat: 1, name: nameOf(me), userId: me.id }, ...users.map((u, i) => ({ seat: i + 2, name: nameOf(u), userId: u.id }))];
  }
  const c = await tx(async (t) => {
    const created = (await t.query('INSERT INTO argue_cases (created_by, mode, topic) OUTPUT INSERTED.* VALUES ($1, $2, $3)', [me.id, data.mode, data.topic || null])).rows[0];
    for (const s of seats) await t.query('INSERT INTO argue_participants (case_id, seat, name, user_id) VALUES ($1, $2, $3, $4)', [created.id, s.seat, s.name, s.userId]);
    return created;
  });
  for (const s of seats) if (s.userId && s.userId !== me.id) await notify(s.userId, me.id, 'argue_invite', c.id, { topic: c.topic, caseId: c.id });
  res.status(201).json({ case: view(await load(c.id, me.id), me.id) });
}));

// My arguments (started by me or invited)
r.get('/', ah(async (req, res) => {
  wakeRemoteAi(); // opening Argue wakes the online AI so the verdict comes quicker
  const rows = await many(
    `SELECT TOP 50 c.* FROM argue_cases c WHERE c.created_by=$1 OR EXISTS (SELECT 1 FROM argue_participants p WHERE p.case_id=c.id AND p.user_id=$1)
      ORDER BY c.created_at DESC`, [req.user.id],
  );
  const out = [];
  for (const c of rows) out.push(view(await load(c.id, req.user.id), req.user.id));
  res.json({ cases: out });
}));

r.get('/:id', ah(async (req, res) => { res.json({ case: view(await load(req.params.id, req.user.id), req.user.id) }); }));

// Give your side. Phone mode: the creator's phone submits for each seat in turn. Invite mode: your own seat.
r.post('/:id/statement', ah(async (req, res) => {
  const me = req.user.id;
  const ctx = await load(req.params.id, me);
  const { c } = ctx;
  if (c.status !== 'open') throw conflict('This argument already has a verdict', 'closed');
  const body = z.object({ seat: z.number().int().min(1).max(6).optional(), text: z.string().trim().min(10, 'Tell a bit more (at least 10 characters)').max(2000) }).parse(req.body);
  let seat;
  if (c.mode === 'phone') {
    if (c.created_by !== me) throw forbidden('Only the phone that started this can add sides');
    seat = body.seat;
    if (!seat) throw badRequest('Which person is speaking?');
  } else {
    if (!ctx.mine) throw forbidden('You are not part of this argument');
    seat = ctx.mine.seat;
  }
  const p = ctx.people.find((x) => x.seat === seat);
  if (!p) throw badRequest('No such person in this argument');
  await query('UPDATE argue_participants SET statement=$3, submitted_at=SYSDATETIMEOFFSET() WHERE case_id=$1 AND seat=$2', [c.id, seat, body.text]);

  const people = await many('SELECT * FROM argue_participants WHERE case_id=$1 ORDER BY seat', [c.id]);
  const ids = userIds(people);
  if (people.every((x) => x.submitted_at)) {
    const claimed = await one(`UPDATE argue_cases SET status=N'judging' OUTPUT INSERTED.* WHERE id=$1 AND status=N'open'`, [c.id]);
    if (claimed) {
      emitToUsers(ids, 'argue:update', { caseId: c.id, status: 'judging' });
      try {
        const { verdict, judge: who } = await judge(c.topic, people.map((x) => ({ seat: x.seat, name: x.name, statement: x.statement })));
        await query(`UPDATE argue_cases SET status=N'decided', verdict=$2, judge=$3, decided_at=SYSDATETIMEOFFSET() WHERE id=$1`, [c.id, JSON.stringify(verdict), who]);
        for (const uid of ids) if (uid !== me) await notify(uid, me, 'argue_verdict', c.id, { caseId: c.id, topic: c.topic });
      } catch (e) {
        await query(`UPDATE argue_cases SET status=N'open' WHERE id=$1`, [c.id]);
        throw e;
      }
    }
  }
  emitToUsers(ids, 'argue:update', { caseId: c.id });
  res.json({ case: view(await load(c.id, me), me) });
}));

export default r;
