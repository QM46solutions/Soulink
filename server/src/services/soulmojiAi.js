// Bridge to the local Soulmoji AI (tools/soulmoji-ai, LivePortrait). Installed with INSTALL-SOULMOJI-AI.bat.
// If it's installed, the server starts it on first use and keeps it running; if not (or it fails), Soulmoji
// falls back to the built-in warp engine, so chat always works.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../tools/soulmoji-ai');
const PORT = Number(process.env.SOULMOJI_AI_PORT || 8211);
const BASE = `http://127.0.0.1:${PORT}`;
const PY = process.platform === 'win32' ? path.join(DIR, '.venv', 'Scripts', 'python.exe') : path.join(DIR, '.venv', 'bin', 'python');
const WEIGHTS = path.join(DIR, 'LivePortrait', 'pretrained_weights', 'liveportrait', 'base_models', 'spade_generator.pth');

let child = null;
let starting = null;

const serviceInstalled = () => process.env.NODE_ENV !== 'test' && fs.existsSync(PY) && fs.existsSync(path.join(DIR, 'soulmoji_ai.py'));
// Online version: the same AI runs on a free Hugging Face Space (tools/soulmoji-space), because it needs ~2 GB of
// memory and Render's free server has 512 MB. Set SOULMOJI_AI_URL (the Space's address) + SOULMOJI_AI_TOKEN.
const REMOTE = () => (process.env.NODE_ENV !== 'test' && process.env.SOULMOJI_AI_URL ? process.env.SOULMOJI_AI_URL.replace(/\/$/, '') : null);
const localInstalled = () => process.env.NODE_ENV !== 'test' && fs.existsSync(PY) && fs.existsSync(WEIGHTS) && fs.existsSync(path.join(DIR, 'soulmoji_ai.py'));
export const aiInstalled = () => !!REMOTE() || localInstalled();

/** Wake the online Soulmoji AI (a free Space sleeps when unused): call when someone opens Soulmoji. */
export function wakeRemoteAi() {
  const url = REMOTE();
  if (url) fetch(`${url}/health`, { signal: AbortSignal.timeout(20000) }).catch(() => {});
}

/** POST to the online AI Space; a sleeping Space takes a minute or two to wake, so keep trying for ~2.5 minutes. */
async function remotePost(route, payload) {
  const url = REMOTE();
  const body = JSON.stringify(payload);
  const until = Date.now() + 150_000;
  for (;;) {
    let r; let j = {};
    try {
      r = await fetch(`${url}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SOULMOJI_AI_TOKEN || ''}` }, body, signal: AbortSignal.timeout(120000) });
      j = await r.json().catch(() => ({}));
    } catch { r = null; }
    if (r?.ok && j.ok) return j;
    if (r && r.status !== 503 && r.status < 500 && r.status !== 404) throw new Error(j.error || `Soulink AI said ${r.status}`);
    if (Date.now() > until) throw new Error(j.error || 'Soulink AI is still waking up');
    await new Promise((res) => setTimeout(res, 5000));
  }
}
/** For other features that use the online AI Space (the Argue referee). */
export const remoteAiOn = () => !!REMOTE();
export const remoteAi = (route, payload) => remotePost(route, payload);

async function remoteEdit(url, srcPath, outPath, mood, recipe) {
  const j = await remotePost('/edit', { image: fs.readFileSync(srcPath).toString('base64'), mood, ...(recipe ? { recipe } : {}) });
  if (!j.image) throw new Error('Soulmoji AI sent no photo');
  fs.writeFileSync(outPath, Buffer.from(j.image, 'base64'));
  return { ok: true, ms: j.ms, remote: true };
}

const scriptVersion = () => String(Math.floor(fs.statSync(path.join(DIR, 'soulmoji_ai.py')).mtimeMs / 1000));

async function healthy() {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    // an older copy of the AI script is still running: ask it to stop so the new one starts
    if (j.version !== scriptVersion()) {
      await fetch(`${BASE}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(1500) }).catch(() => {});
      await new Promise((res) => setTimeout(res, 1500));
      return false;
    }
    return true;
  } catch { return false; }
}

async function ensureRunning() {
  if (await healthy()) return true;
  if (!starting) {
    starting = (async () => {
      // loading the models takes 20-90 s the first time. Checked every second; if our copy has exited
      // (e.g. an older version was just asked to stop), a fresh one is started.
      let lastSpawn = 0;
      for (let i = 0; i < 180; i += 1) {
        if ((!child || child.exitCode !== null) && Date.now() - lastSpawn > 15000) {
          lastSpawn = Date.now();
          const log = fs.openSync(path.join(DIR, 'ai.log'), 'a');
          const c = spawn(PY, [path.join(DIR, 'soulmoji_ai.py')], { cwd: DIR, stdio: ['ignore', log, log], windowsHide: true });
          c.on('exit', () => { if (child === c) child = null; });
          child = c;
        }
        if (await healthy()) return true;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return false;
    })().finally(() => { starting = null; });
  }
  return starting;
}

/** Edit the expression on srcPath and write the result to outPath. Throws if the AI isn't available. */
export async function aiEdit(srcPath, outPath, mood, recipe) {
  if (REMOTE()) return remoteEdit(REMOTE(), srcPath, outPath, mood, recipe);
  if (!localInstalled()) throw new Error('Soulmoji AI not installed');
  if (!(await ensureRunning())) throw new Error('Soulmoji AI did not start');
  const r = await fetch(`${BASE}/edit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src: srcPath, out: outPath, mood, ...(recipe ? { recipe } : {}) }), signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'Soulmoji AI failed');
  return j;
}

// Warm it up in the background when the server starts, so the first Soulmoji is quicker
export function warmSoulmojiAi() { if (REMOTE()) return wakeRemoteAi(); if (localInstalled() || translatorInstalled()) ensureRunning().catch(() => {}); }
process.on('exit', () => { try { child?.kill(); } catch { /* already gone */ } });

// ---------- chat translator (NLLB-200 model in the same local service) ----------
export const TRANSLATE_LANGS = ['en', 'hi', 'te', 'bn'];
export const translatorInstalled = () => serviceInstalled() && fs.existsSync(path.join(DIR, 'models', 'nllb-200-distilled-600M', 'config.json'));

/** Which of our languages a message is written in, from its script (Devanagari = Hindi, Telugu, Bengali, else English). */
export function detectLanguage(text) {
  const counts = { hi: 0, te: 0, bn: 0, en: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0x0900 && c <= 0x097f) counts.hi += 1;
    else if (c >= 0x0c00 && c <= 0x0c7f) counts.te += 1;
    else if (c >= 0x0980 && c <= 0x09ff) counts.bn += 1;
    else if (/[a-z]/i.test(ch)) counts.en += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// Online (cloud) version: the laptop's translation model can't run on the free server (it needs ~2.5 GB),
// so text goes to free online translators instead, tried in this order until one answers:
//   1. Microsoft Translator (Azure "F0" free tier: 2 million characters a month, official, never charges),
//      only when AZURE_TRANSLATOR_KEY (+ AZURE_TRANSLATOR_REGION) are set on the server
//   2. Google Translate's free web endpoint (no key, no daily cap for a small app; unofficial)
//   3. MyMemory (no key; small daily allowance, bigger with TRANSLATE_EMAIL)
// Finished translations are remembered for a while, so the same message never uses the allowance twice.
const cloudTranslateOn = () => process.env.NODE_ENV !== 'test' && (process.env.TRANSLATE_PROVIDER || 'auto') !== 'off';
export const canTranslate = () => translatorInstalled() || cloudTranslateOn();

const decode = (s) => String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function chunks(text, max = 450) {
  const parts = String(text).match(/[^.!?।\n]+[.!?।]*\s*|\n+/g) || [String(text)];
  const out = []; let cur = '';
  for (const p of parts) {
    if ((cur + p).length > max && cur) { out.push(cur); cur = ''; }
    if (p.length > max) { for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max)); } else cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

async function viaAzure(text, from, to) {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key) return null;
  const headers = { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' };
  if (process.env.AZURE_TRANSLATOR_REGION) headers['Ocp-Apim-Subscription-Region'] = process.env.AZURE_TRANSLATOR_REGION;
  const qs = `api-version=3.0&to=${encodeURIComponent(to)}${from && from !== 'auto' ? `&from=${encodeURIComponent(from)}` : ''}`;
  const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?${qs}`, { method: 'POST', headers, body: JSON.stringify([{ Text: text }]), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`azure ${r.status}`);
  const t = (await r.json())?.[0]?.translations?.[0]?.text;
  if (!t) throw new Error('azure empty');
  return t;
}

export function parseGoogle(j) {
  // [[["translated piece","original piece",…],…],…]
  if (!Array.isArray(j) || !Array.isArray(j[0])) return null;
  const t = j[0].map((x) => (Array.isArray(x) && typeof x[0] === 'string' ? x[0] : '')).join('');
  return t.trim() ? t : null;
}
async function viaGoogle(text, from, to) {
  const out = [];
  for (const piece of chunks(text, 1800)) {
    if (!piece.trim()) { out.push(piece); continue; }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(from || 'auto')}&tl=${encodeURIComponent(to)}`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `q=${encodeURIComponent(piece)}`, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`google ${r.status}`);
    const t = parseGoogle(await r.json().catch(() => null));
    if (!t) throw new Error('google empty');
    out.push(t + (/\s$/.test(piece) && !/\s$/.test(t) ? ' ' : ''));
  }
  return out.join('').trim();
}

async function viaMyMemory(text, from, to) {
  const email = process.env.TRANSLATE_EMAIL ? `&de=${encodeURIComponent(process.env.TRANSLATE_EMAIL)}` : '';
  const out = [];
  for (const piece of chunks(text)) {
    if (!piece.trim()) { out.push(piece); continue; }
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(piece.trim())}&langpair=${from}|${to}${email}`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    const t = j?.responseData?.translatedText;
    if (!r.ok || Number(j?.responseStatus) !== 200 || !t || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error('mymemory limit');
    out.push(decode(t) + (/\s$/.test(piece) ? ' ' : ''));
  }
  return out.join('').trim();
}

const cache = new Map(); // "from|to|text" -> translation (newest last; oldest dropped past 3000)
const failedUntil = {};   // provider -> time it may be tried again after failing (skip a broken one for a bit)
async function cloudTranslate(text, from, to) {
  const k = `${from}|${to}|${text}`;
  if (cache.has(k)) { const v = cache.get(k); cache.delete(k); cache.set(k, v); return v; }
  const order = { azure: viaAzure, google: viaGoogle, mymemory: viaMyMemory };
  const wanted = (process.env.TRANSLATE_PROVIDER || 'auto').toLowerCase();
  const names = order[wanted] ? [wanted, ...Object.keys(order).filter((n) => n !== wanted)] : Object.keys(order);
  for (const n of names) {
    if (failedUntil[n] > Date.now()) continue;
    try {
      const t = await order[n](text, from, to);
      if (t == null) continue; // not set up (no key)
      cache.set(k, t); if (cache.size > 3000) cache.delete(cache.keys().next().value);
      return t;
    } catch (e) {
      failedUntil[n] = Date.now() + (n === 'mymemory' ? 30 * 60_000 : 2 * 60_000);
      console.warn(`[translate] ${n} failed: ${e.message}`);
    }
  }
  throw new Error('The translator is busy right now. Try again in a minute.');
}

export async function aiTranslate(text, from, to) {
  if (!translatorInstalled()) {
    if (cloudTranslateOn()) return cloudTranslate(text, from, to);
    throw new Error('Chat translator not installed');
  }
  if (!(await ensureRunning())) throw new Error('Translator did not start');
  const r = await fetch(`${BASE}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, src: from, tgt: to }), signal: AbortSignal.timeout(120000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'Translation failed');
  return j.text;
}

// ---------- voice translator (Whisper speech-to-text + MMS-TTS voices, same local service) ----------
const MODELS = path.join(DIR, 'models');
export const voiceInstalled = () => !!REMOTE() || localVoice();
const localVoice = () => translatorInstalled()
  && fs.existsSync(path.join(MODELS, 'whisper-small', 'config.json'))
  && ['eng', 'hin', 'tel', 'ben'].every((c) => fs.existsSync(path.join(MODELS, `mms-tts-${c}`, 'config.json')));

async function voiceCall(route, body, timeoutMs) {
  if (!localVoice()) throw new Error('Voice translator not installed');
  if (!(await ensureRunning())) throw new Error('Voice translator did not start');
  const r = await fetch(`${BASE}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'Voice translation failed');
  return j;
}

/** Voice note file -> what was said (auto-detects English / Hindi / Telugu / Bengali unless `lang` is given). */
export async function aiTranscribe(srcPath, lang) {
  // online: the voice models run on the same free Hugging Face Space as Soulmoji AI
  if (REMOTE()) return (await remotePost('/transcribe', { audio: fs.readFileSync(srcPath).toString('base64'), ext: path.extname(srcPath) || '.webm', lang: lang || null })).text;
  return (await voiceCall('/transcribe', { src: srcPath, lang: lang || null }, 240000)).text;
}

/** Text -> spoken voice clip in that language. Returns { file, durationMs } (file may end .m4a or .wav). */
export async function aiSpeak(text, lang, outPath) {
  if (REMOTE()) {
    const r = await remotePost('/speak', { text, lang });
    const file = r.ext && r.ext !== path.extname(outPath) ? outPath.replace(/\.[a-z0-9]+$/i, r.ext) : outPath;
    fs.writeFileSync(file, Buffer.from(r.audio, 'base64'));
    return { file, durationMs: r.durationMs };
  }
  const j = await voiceCall('/speak', { text, lang, out: outPath }, 240000);
  return { file: j.out, durationMs: j.durationMs };
}
