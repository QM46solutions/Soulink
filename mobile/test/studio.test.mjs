// Soulink Studio edit model (lib/studio.js): run with  node mobile/test/studio.test.mjs
import assert from 'node:assert/strict';
const S = await import('../src/lib/studio.js');
let p = S.emptyProject();
const v1 = S.makeClip({ uri: 'a.mp4', type: 'video/mp4', duration: 20 });
const ph = S.makeClip({ uri: 'b.jpg', type: 'image/jpeg' });
const v2 = S.makeClip({ uri: 'c.mp4', type: 'video/mp4', duration: 90 });
p = S.addClips(p, [v1, ph, v2]);
assert.equal(S.totalLen(p), 20 + 3 + 60);
assert.deepEqual(S.problems(p).length, 1); // too long
p = S.trimClip(p, v2.id, 10, 30); assert.equal(S.totalLen(p), 43);
p = S.setSpeed(p, v1.id, 2); assert.equal(S.clipLen(p.clips[0]), 10); assert.equal(S.totalLen(p), 33);
let hit = S.locate(p, 11); assert.equal(hit.index, 1); assert.equal(hit.clip.kind, 'photo');
hit = S.locate(p, 5); assert.equal(hit.source, 10); // 5 s at 2x = source 10
p = S.splitAt(p, 5); assert.equal(p.clips.length, 4); assert.equal(p.clips[0].out, 10); assert.equal(p.clips[1].in, 10); assert.equal(S.totalLen(p), 33);
assert.equal(S.splitAt(p, 0.05), p); // too close to the edge: nothing
p = S.moveClip(p, p.clips[3].id, 0); assert.equal(p.clips[0].uri, 'c.mp4');
p = S.duplicateClip(p, p.clips[0].id); assert.equal(p.clips.length, 5);
p = S.removeClip(p, p.clips[1].id); assert.equal(p.clips.length, 4);
// overlays + fitting
p = S.addOverlay(p, { kind: 'text', t: 'Hi', style: 'neon', color: '#ffffff', size: 30, from: 40, to: 80 });
p = S.fitOverlays(p); const len = S.totalLen(p); assert.ok(p.overlays[0].to <= len && p.overlays[0].from < p.overlays[0].to);
// history
let h = S.history(S.emptyProject()); h = S.commit(h, p); h = S.commit(h, S.removeClip(p, p.clips[0].id));
assert.equal(h.present.clips.length, 3); h = S.undo(h); assert.equal(h.present.clips.length, 4); h = S.redo(h); assert.equal(h.present.clips.length, 3);
let h2 = S.history(p); h2 = S.commit(h2, S.updateOverlay(p, p.overlays[0].id, { x: 0.3 }), 'drag'); h2 = S.commit(h2, S.updateOverlay(h2.present, p.overlays[0].id, { x: 0.2 }), 'drag');
assert.equal(h2.past.length, 1); // drag merged into one step
// legacy for a single video
let q = S.addClips(S.emptyProject(), [S.makeClip({ uri: 'x.mp4', type: 'video/mp4', duration: 30 })]);
q = S.trimClip(q, q.clips[0].id, 5, 25); q = S.setSpeed(q, q.clips[0].id, 2);
q = S.addOverlay(q, { kind: 'sticker', e: '🔥', size: 70, scale: 1.5, rot: 20, from: 2, to: 4 });
const L = S.toLegacyEdit(q);
assert.deepEqual(L.trim, [5, 25]); assert.equal(L.speed, '2'); assert.equal(L.stickers[0].size, 105); assert.equal(L.stickers[0].from, 9); assert.equal(L.stickers[0].to, 13); assert.equal(L.stickers[0].rot, 20);
assert.ok(S.isSingleVideo(q));
const R = S.toRecipe(q); assert.equal(R.len, 10); assert.ok(!JSON.stringify(R).includes('x.mp4'));
console.log('all studio tests passed');
