// Test helpers: uses a separate database (soulink_test) that is wiped before each test file.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'soulink_test';
process.env.OTP_DEV_ECHO = 'true';
process.env.ANTHROPIC_API_KEY = ''; // tests always use the basic referee (no AI calls)
process.env.AI_PROVIDER = 'basic';

const { query, closePool } = await import('../src/db.js');
const { migrate, dropAll } = await import('../src/migrate.js');
const { createApp } = await import('../src/app.js');
const request = (await import('supertest')).default;

export { query, closePool };
export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
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
