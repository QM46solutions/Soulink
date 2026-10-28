// Test helpers: uses a separate database (soulink_test) that is wiped before each test file.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'soulink_test';
process.env.OTP_DEV_ECHO = 'true';
process.env.ANTHROPIC_API_KEY = ''; // tests always use the basic referee (no AI calls)
process.env.AI_PROVIDER = 'basic';
// Tests never touch the real uploads folder (server/uploads): their photos, voice notes and Soulmojis go to a
// temporary folder that is emptied at the start of each test file.
import os from 'node:os';
import nodePath from 'node:path';
import nodeFs from 'node:fs';
process.env.UPLOAD_DIR = nodePath.join(os.tmpdir(), 'soulink-test-uploads');
nodeFs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
nodeFs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

const { query, closePool, waitForDatabase } = await import('../src/db.js');
const { migrate, dropAll } = await import('../src/migrate.js');
const { createApp } = await import('../src/app.js');
const request = (await import('supertest')).default;

export { query, closePool };
export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await waitForDatabase(); // SQL Server may still be starting
  await dropAll();
  await migrate({ log: false });
}

let phoneSeq = 9000000000;

/** Creates a fully onboarded user and returns { token, user, auth() } */
export async function makeUser(overrides = {}) {
  const phone = String(phoneSeq++);
  const req1 = await api().post('/auth/otp/request').send({ phone }).expect(200);
  const v = await api().post('/auth/otp/verify').send({ phone, code: req1.body.devCode }).expect(200);
  const token = v.body.token;
  const username = overrides.username || `user${phone.slice(-6)}`;
  const done = await api()
    .post('/users/me/complete-onboarding')
    .set('Authorization', `Bearer ${token}`)
    .send({ username, displayName: overrides.displayName || `User ${phone.slice(-4)}`, birthDate: '1995-05-10' })
    .expect(200);
  if (overrides.isPrivate) {
    await api().patch('/users/me').set('Authorization', `Bearer ${token}`).send({ isPrivate: true }).expect(200);
  }
  return { token, user: done.body.user, h: { Authorization: `Bearer ${token}` } };
}

const { sampleAnswers } = await import('../src/services/soulDna.js');
export { sampleAnswers };
/** Answers every Soul DNA question (k picks a different "person") and completes it. */
export async function makeDna(u, k = 0) {
  // answer this person's own scenarios (and any extra ones Soul DNA adds), then finish
  const all = sampleAnswers(k);
  const d = (await api().get('/soul/dna').set(u.h).expect(200)).body;
  let r = await api().put('/soul/dna/answers').set(u.h).send({ answers: Object.fromEntries(d.questions.map((q) => [q.id, all[q.id]])) }).expect(200);
  while (r.body.added?.length) r = await api().put('/soul/dna/answers').set(u.h).send({ answers: Object.fromEntries(r.body.added.map((q) => [q.id, all[q.id]])) }).expect(200);
  return api().post('/soul/dna/complete').set(u.h).expect(200);
}
