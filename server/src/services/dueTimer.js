// Time-based events must happen on time even when nobody is using Soulink:
//   - a Connect hold ends → the receiver is asked "accept or reject?"
//   - 24 hours later with no answer → rejected automatically (sender told, chat hidden)
//   - an anonymous message's hidden time is up → both are told who it was
// The every-minute timers only run while people are active (so the free cloud database can pause).
// This timer instead sleeps until the next due moment, wakes the database just then, does the work and
// sends the notifications, then sleeps until the next one. Nothing is checked in between.
import { one } from '../db.js';
import { isDbReady } from '../activity.js';
import { config } from '../config.js';
import { processHolds } from './connections.js';
import { processAnonReveals } from './anon.js';

const MAX_WAIT = 2 ** 31 - 1; // setTimeout's longest wait (~24.8 days)
let timer = null;
let dueAt = null;

async function run() {
  timer = null; dueAt = null;
  try { await processHolds(); await processAnonReveals(); } catch (e) { console.error('due timer:', e.message); }
  scheduleNext().catch(() => {});
}

function arm(at) {
  if (timer && dueAt && dueAt <= at) return; // something earlier is already set
  clearTimeout(timer);
  dueAt = at;
  const wait = Math.max(5_000, at - Date.now() + 2_000); // a moment after it's due
  if (wait > MAX_WAIT) { timer = setTimeout(() => { timer = null; arm(at); }, MAX_WAIT); timer.unref?.(); return; } // re-arm, no database
  timer = setTimeout(run, wait);
  timer.unref?.();
}

/** Finds the next due event and sleeps until then. Call it after anything that sets a due time. */
export async function scheduleNext() {
  if (config.env === 'test' || !isDbReady()) return; // tests run the checks themselves
  const r = await one(`SELECT MIN(t) AS t FROM (
      SELECT MIN(COALESCE(hold_decide_until, hold_until)) AS t FROM connection_requests WHERE status=N'held'
      UNION ALL SELECT MIN(reveal_at) FROM anon_threads WHERE revealed_at IS NULL) x`, []);
  if (r?.t) arm(new Date(r.t).getTime());
}

export const nudgeDueTimer = () => { scheduleNext().catch(() => {}); };
