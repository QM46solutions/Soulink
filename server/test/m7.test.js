// Translator in the message box (text drafts + voice clips). The AI models aren't loaded in tests,
// so this checks the rules: same-language drafts pass through, 503 when not installed, own clips only.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna } from './helpers.js';

before(resetDb);
after(() => closePool());

const quiz = (u, k = 0) => makeDna(u, k);
async function chat() {
  const a = await makeUser(); const b = await makeUser(); await quiz(a); await quiz(b, 1);
  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  const acc = await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200);
  return { a, b, conv: acc.body.conversationId };
}

describe('Message-box translator', () => {
  test('a draft already in the chosen language is returned as it is', async () => {
    const { a, conv } = await chat();
    const r = await api().post(`/conversations/${conv}/translate-draft`).set(a.h).send({ text: 'See you tomorrow', to: 'en' }).expect(200);
    assert.equal(r.body.same, true);
    assert.equal(r.body.text, 'See you tomorrow');
  });

  test('says clearly when the translator / voice models are not installed', async () => {
    const { a, conv } = await chat();
    await api().post(`/conversations/${conv}/translate-draft`).set(a.h).send({ text: 'See you tomorrow', to: 'te' }).expect(503);
    await api().post(`/conversations/${conv}/translate-draft`).set(a.h).send({ text: 'See you tomorrow', to: 'en', output: 'voice' }).expect(503);
  });

  test("you can't send someone else's (or a made-up) voice clip", async () => {
    const { a, b, conv } = await chat();
    const fake = `/uploads/voice-tr/${b.user.id.toUpperCase()}-${'1'.repeat(8)}-1111-1111-1111-${'1'.repeat(12)}.m4a`;
    await api().post(`/conversations/${conv}/messages`).set(a.h).send({ voice: { url: fake, durationMs: 1200 } }).expect(400);
  });
});
