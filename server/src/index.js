import http from 'node:http';
import os from 'node:os';
import { config } from './config.js';
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { waitForDatabase } from './db.js';
import { markDbStarting, setDbReady } from './activity.js';
import { initRealtime } from './realtime.js';
import { initFaceEngine } from './services/faceEngine.js';
import { startHoldTimer } from './services/connections.js';
import { startAnonTimer } from './services/anon.js';
import { purgeDeletedAccounts } from './services/account.js';
import { purgeAuditLog } from './services/audit.js';
import { purgeExpiredBans, runScheduledDeletions } from './services/lifecycle.js';
import { sealPlainFaces } from './lib/faceCrypto.js';
import { localAiStatus } from './services/referee.js';

const cloud = !!process.env.RENDER_EXTERNAL_URL || config.env === 'production';
async function startDatabase() {
  // after a restart (or while the free cloud database is resuming) it can take a minute to accept connections
  await waitForDatabase({ maxMs: cloud ? 10 * 60_000 : 150_000 });
  await migrate({ log: false });
  const sealed = await sealPlainFaces(); // face fingerprints stored before encryption: encrypt them now
  if (sealed) console.log(`   Encrypted ${sealed} stored face fingerprint(s)`);
  setDbReady();
}
if (cloud) {
  markDbStarting();
  // cloud: open the web server straight away (the page loads fast) and get the database ready in the background
  (async function boot() {
    try { await startDatabase(); console.log('   Database ready'); }
    catch (e) { console.error(`   Database not ready yet (${e.message}); trying again in 15 s`); setTimeout(boot, 15_000); }
  })();
} else {
  try { await startDatabase(); } catch (e) {
    console.error('\n❌ Soulink could not start: there is a problem with the database.');
    console.error(`   ${e.message}`);
    console.error('   Check that SQL Server (SQLEXPRESS) is running and that server/.env has the right DB_ settings.');
    console.error('   Running SETUP-SOULINK.bat again fixes most problems.\n');
    process.exit(1);
  }
}

const server = http.createServer(createApp());
purgeDeletedAccounts(); setInterval(purgeDeletedAccounts, 24 * 3600_000).unref?.();
purgeAuditLog(); setInterval(purgeAuditLog, 24 * 3600_000).unref?.(); // audit trail and login sessions kept 365 days
const lifecycle = () => { runScheduledDeletions(); purgeExpiredBans(); };
setTimeout(lifecycle, 60_000).unref?.(); setInterval(lifecycle, 3600_000).unref?.(); // accounts whose 30 days are over are erased // sign-up records of deleted accounts: kept 180 days
startHoldTimer(); // Hold reminders + auto-suspend, checked every minute
startAnonTimer(); // Anonymous chats: reveal the sender after 7 days, checked every minute
initRealtime(server);

// Render's free plan puts the web server to sleep after 15 minutes without visitors, and waking it takes
// about a minute. A tiny self-visit every 10 minutes keeps it awake. It never touches the database,
// so the free cloud database still pauses itself when nobody is using Soulink.
if (process.env.RENDER_EXTERNAL_URL) {
  const url = `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`;
  setInterval(() => { fetch(url).catch(() => {}); }, 10 * 60_000).unref?.();
}

server.listen(config.port, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n✨ Soulink server running`);
  console.log(`   On this laptop:  http://localhost:${config.port}`);
  ips.forEach((ip) => console.log(`   From your phone: http://${ip}:${config.port}`));
  console.log(`   Database: SQL Server ${config.db.server}:${config.db.port}/${config.db.database}`);
  console.log(`   OTP delivery: ${config.smsProvider} · AI: ${config.aiProvider} · Face: ${config.faceProvider}\n`);
  // Load the face models in the background so the first Face ID scan is quick
  const t0 = Date.now();
  initFaceEngine()
    .then(() => console.log(`   Face ID engine ready (${((Date.now() - t0) / 1000).toFixed(1)}s)`))
    .catch((e) => console.error(`   ⚠ Face ID engine failed to load: ${e.message}. Run UPDATE-SOULINK.bat.`));
  if (config.aiProvider === 'local') {
    localAiStatus().then((a) => console.log(a.ok ? `   Free AI referee ready (${a.model})` : `   Free AI referee off: ${a.reason}. Argue uses the basic judge.`));
  }
});
