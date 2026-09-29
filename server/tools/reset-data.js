// Erases ALL Soulink user data on this laptop and rebuilds empty tables (a fresh start for testing).
// Removes: accounts, profiles, face fingerprints, Soul DNA, follows, chats, notifications, uploaded photos.
// Keeps: the code, settings (.env) and the separate test database.
// Run with RESET-SOULINK-DATA.bat. Refuses to run in production.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { closePool } from '../src/db.js';
import { dropAll, migrate } from '../src/migrate.js';

if (!config.isDev) { console.error('Refusing to erase data: this is a production server.'); process.exit(1); }

console.log(`Erasing all data in database "${config.db.database}"...`);
await dropAll();
await migrate({ log: false });
console.log('   Database emptied and tables rebuilt.');

let files = 0;
if (fs.existsSync(config.uploadDir)) {
  for (const entry of fs.readdirSync(config.uploadDir)) {
    if (entry === '.gitkeep') continue;
    fs.rmSync(path.join(config.uploadDir, entry), { recursive: true, force: true });
    files += 1;
  }
}
console.log(`   Uploaded photos and voice notes removed (${files} folder(s)).`);
await closePool();
console.log('Done. Soulink is fresh. In the browser, refresh the page (F5): you will be on the welcome screen.');
process.exit(0);
