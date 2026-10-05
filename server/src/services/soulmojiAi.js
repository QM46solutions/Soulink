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

export const aiInstalled = () => process.env.NODE_ENV !== 'test' && fs.existsSync(PY) && fs.existsSync(WEIGHTS) && fs.existsSync(path.join(DIR, 'soulmoji_ai.py'));

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
      if (!child || child.exitCode !== null) {
        const log = fs.openSync(path.join(DIR, 'ai.log'), 'a');
        child = spawn(PY, [path.join(DIR, 'soulmoji_ai.py')], { cwd: DIR, stdio: ['ignore', log, log], windowsHide: true });
        child.on('exit', () => { child = null; });
      }
      // loading the models takes 20-90 s the first time
      for (let i = 0; i < 180; i += 1) { if (await healthy()) return true; await new Promise((r) => setTimeout(r, 1000)); }
      return false;
    })().finally(() => { starting = null; });
  }
  return starting;
}

/** Edit the expression on srcPath and write the result to outPath. Throws if the AI isn't available. */
export async function aiEdit(srcPath, outPath, mood, recipe) {
  if (!aiInstalled()) throw new Error('Soulmoji AI not installed');
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
export function warmSoulmojiAi() { if (aiInstalled()) ensureRunning().catch(() => {}); }
process.on('exit', () => { try { child?.kill(); } catch { /* already gone */ } });
