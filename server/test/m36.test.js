// Legal: Grievance Officer complaints (ticket, deadlines, decision), police / court orders (3-hour takedown),
// bans from the console (owner only), and the AI marker inside Soulmoji images.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jpeg from 'jpeg-js';
import { api, resetDb, closePool, query, makeUser } from './helpers.js';
import { isAiMarked, markAiJpeg } from '../src/lib/aiMark.js';

before(resetDb);
after(() => closePool());

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function code(secret) {
  let bits = ''; for (const c of secret) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = []; for (let i = 0; i + 8 <= bits.length; i += 8) key.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = crypto.createHmac('sha1', Buffer.from(key)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
const PW = 'correct horse battery';
const T = (t) => ({ Authorization: `Bearer ${t}` });
let owner; let support;
const aPost = async (u, caption = 'Golconda evening') => (await api().post('/posts').set(u.h).field('caption', caption).expect(201)).body.post;

test('console team: an owner and a support person', async () => {
  process.env.CONSOLE_SETUP_KEY = 'setup-key-for-tests';
  const { secret } = (await api().post('/console/auth/new-secret').send({ email: 'sai@qm46.in' }).expect(200)).body;
  owner = (await api().post('/console/auth/setup').send({ setupKey: 'setup-key-for-tests', email: 'sai@qm46.in', name: 'Sai', password: PW, secret, code: code(secret) }).expect(200)).body.token;
  const inv = (await api().post('/console/team').set(T(owner)).send({ email: 'help@qm46.in', name: 'Helper', role: 'support' }).expect(200)).body;
  const { secret: s2 } = (await api().post('/console/auth/new-secret').send({ email: 'help@qm46.in' }).expect(200)).body;
  support = (await api().post('/console/auth/accept').send({ email: 'help@qm46.in', inviteCode: inv.inviteCode, password: PW, secret: s2, code: code(s2) }).expect(200)).body.token;
  assert.ok(owner && support);
});

test('anyone can file a complaint: ticket number, 7-day deadline, and the 2-hour clock for intimate / impersonation', async () => {
  const bad = { name: 'Asha', email: 'asha@example.com', category: 'content', details: 'too short' };
  await api().post('/grievances').send(bad).expect(400);
  await api().post('/grievances').send({ ...bad, category: 'nonsense', details: 'This comment calls me names every day.' }).expect(400);
  const a = (await api().post('/grievances').send({ ...bad, details: 'This comment calls me names every day and it will not stop.' }).expect(201)).body;
  assert.ok(a.ticket >= 5001); assert.equal(a.urgent, false);
  const days = (new Date(a.dueAt) - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days <= 7.01, `due in ${days} days`);
  const u = await makeUser();
  const b = (await api().post('/grievances').set(u.h).send({ name: 'Meera', email: 'meera@example.com', category: 'intimate_or_impersonation', aboutUsername: '@faker', details: 'Someone made an account with my photos pretending to be me.' }).expect(201)).body;
  assert.equal(b.urgent, true);
  const hrs = (new Date(b.dueAt) - Date.now()) / 3600000;
  assert.ok(hrs > 1.9 && hrs <= 2.01, `due in ${hrs} hours`);
  const mine = (await api().get('/grievances/mine').set(u.h).expect(200)).body.complaints;
  assert.equal(mine.length, 1); assert.equal(mine[0].ticket, b.ticket); assert.equal(mine[0].handledBy, undefined);
});

test('the console lists complaints (urgent first); deciding one can remove the linked post and emails both sides', async () => {
  const poster = await makeUser(); const viewer = await makeUser(); const p = await aPost(poster, 'mean post');
  await api().post('/grievances').send({ name: 'Ravi', email: 'ravi@example.com', category: 'content', aboutUrl: `https://soulink.app/post/${p.id}`, details: 'This post shares my phone number without my consent.' }).expect(201);
  // app users and ads managers can't see it; support can
  await api().get('/console/legal').set(poster.h).expect(401);
  const l = (await api().get('/console/legal').set(T(support)).expect(200)).body;
  assert.equal(l.complaints[0].urgent, true, 'urgent complaints come first');
  assert.ok(l.summary.open_complaints >= 3);
  const g = l.complaints.find((x) => x.name === 'Ravi');
  await api().patch(`/console/legal/complaints/${g.id}`).set(T(support)).send({ status: 'resolved' }).expect(400); // a reply is required
  const r = (await api().patch(`/console/legal/complaints/${g.id}`).set(T(support)).send({ status: 'resolved', resolution: 'We removed the post: it shared your phone number.', removeContent: true }).expect(200)).body;
  assert.equal(r.removed, 1);
  const seen = await api().get(`/posts/${p.id}`).set(viewer.h).expect(404);
  assert.equal(seen.body.error?.code || seen.body.code, 'complaint_removed');
  const closed = (await api().get('/console/legal?status=closed').set(T(owner)).expect(200)).body.complaints;
  assert.ok(closed.some((x) => x.id === g.id && x.status === 'resolved' && x.handledBy === 'Helper'));
});

test('a court order must be verified; its takedown clock is 3 hours; acting on it removes every linked post', async () => {
  const u = await makeUser(); const p1 = await aPost(u, 'one'); const p2 = await aPost(u, 'two'); const viewer = await makeUser();
  const order = { source: 'court', authority: 'City Civil Court, Hyderabad', orderRef: 'OS 12/2026', kind: 'takedown', summary: 'Remove two defamatory posts by the account.', contentUrls: [`https://soulink.app/post/${p1.id}`, `https://soulink.app/post/${p2.id}`] };
  await api().post('/console/legal/orders').set(T(support)).send({ ...order, verified: false }).expect(400);
  const o = (await api().post('/console/legal/orders').set(T(support)).send({ ...order, verified: true }).expect(201)).body.order;
  const hrs = (new Date(o.dueAt) - new Date(o.receivedAt)) / 3600000;
  assert.equal(Math.round(hrs), 3);
  const info = (await api().post('/console/legal/orders').set(T(support)).send({ source: 'police', authority: 'Cyber Crime PS, Hyderabad', kind: 'info_request', summary: 'Account details for @someone in FIR 45/2026.', verified: true }).expect(201)).body.order;
  assert.equal(Math.round((new Date(info.dueAt) - new Date(info.receivedAt)) / 3600000), 72);
  const done = (await api().post(`/console/legal/orders/${o.id}`).set(T(support)).send({ action: 'remove' }).expect(200)).body;
  assert.equal(done.removed, 2); assert.equal(done.status, 'done');
  const seen = await api().get(`/posts/${p1.id}`).set(viewer.h).expect(404);
  assert.equal(seen.body.error?.code || seen.body.code, 'legal_removed');
  await api().post(`/console/legal/orders/${info.id}`).set(T(support)).send({ action: 'done' }).expect(400); // needs a note
  await api().post(`/console/legal/orders/${info.id}`).set(T(support)).send({ action: 'done', note: 'Shared username, phone and join date with SI Rao by email.' }).expect(200);
});

test('only the owner can ban from the console; the person can never sign up again until the ban is lifted', async () => {
  const u = await makeUser();
  const uname = (await query('SELECT username FROM users WHERE id=$1', [u.user.id])).rows[0].username;
  await api().post('/console/legal/bans').set(T(support)).send({ username: uname, reason: 'Repeated harassment of three people', confirm: true }).expect(403);
  await api().post('/console/legal/bans').set(T(owner)).send({ username: uname, reason: 'Repeated harassment of three people' }).expect(400); // must confirm
  await api().post('/console/legal/bans').set(T(owner)).send({ username: uname, reason: 'Repeated harassment of three people', confirm: true }).expect(200);
  assert.equal((await query('SELECT COUNT(*) AS n FROM users WHERE id=$1', [u.user.id])).rows[0].n, 0, 'account erased');
  const l = (await api().get('/console/legal').set(T(support)).expect(200)).body;
  const b = l.bans.find((x) => x.username === uname);
  assert.ok(b); assert.equal(b.phone, undefined, 'the console does not show the phone number');
  await api().post(`/console/legal/bans/${b.id}/lift`).set(T(support)).send({ reason: 'Appeal accepted after review' }).expect(403);
  await api().post(`/console/legal/bans/${b.id}/lift`).set(T(owner)).send({ reason: 'Appeal accepted after review' }).expect(200);
  assert.ok(!(await api().get('/console/legal').set(T(owner)).expect(200)).body.bans.some((x) => x.id === b.id));
});

test('Soulmoji images carry an AI marker inside the file, and still open as normal JPEGs', () => {
  const img = { width: 8, height: 8, data: Buffer.alloc(8 * 8 * 4, 200) };
  const plain = Buffer.from(jpeg.encode(img, 90).data);
  assert.equal(isAiMarked(plain), false);
  const marked = markAiJpeg(plain);
  assert.equal(isAiMarked(marked), true);
  assert.ok(marked.toString('latin1').includes('AI-generated'));
  assert.equal(markAiJpeg(marked).length, marked.length, 'marking twice adds nothing');
  const back = jpeg.decode(marked, { useTArray: true });
  assert.equal(back.width, 8);
  assert.equal(markAiJpeg(Buffer.from('not a jpeg')).toString(), 'not a jpeg');
});
