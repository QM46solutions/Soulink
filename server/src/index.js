import http from 'node:http';
import os from 'node:os';
import { config } from './config.js';
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { initRealtime } from './realtime.js';
import { initFaceEngine } from './services/faceEngine.js';

try {
  await migrate({ log: false });
} catch (e) {
  console.error('\n❌ Soulink could not start: there is a problem with the database.');
  console.error(`   ${e.message}`);
  console.error('   Check that SQL Server (SQLEXPRESS) is running and that server/.env has the right DB_ settings.');
  console.error('   Running SETUP-SOULINK.bat again fixes most problems.\n');
  process.exit(1);
}

const server = http.createServer(createApp());
initRealtime(server);

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
});
