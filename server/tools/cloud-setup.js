// SETUP-CLOUD.bat: asks for the free cloud database details once and saves them in server\cloud.env
// (only on this laptop, never uploaded). Then checks that the cloud database answers.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import dotenv from 'dotenv';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cloud.env');
const old = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, d) => ((await rl.question(`  ${q}${d ? ` [${d}]` : ''}: `)).trim() || d || '');

console.log('\n  Soulink cloud settings (press Enter to keep the value in brackets)\n');
let server = await ask('Azure SQL server name (looks like soulink-sai.database.windows.net)', old.DB_SERVER);
if (server && !server.includes('.')) server = `${server}.database.windows.net`;
const db = await ask('Database name', old.DB_NAME || 'soulink');
const user = await ask('Admin login (user name)', old.DB_USER);
const pass = await ask('Admin password', old.DB_PASSWORD);
const code = await ask('Access code for your friends (anything, e.g. soul2026)', old.ACCESS_CODE);
rl.close();

const env = { DB_SERVER: server, DB_PORT: '1433', DB_NAME: db, DB_USER: user, DB_PASSWORD: pass, DB_ENCRYPT: 'true', DB_TRUST_SERVER_CERT: 'false', ACCESS_CODE: code };
fs.writeFileSync(file, Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n');
console.log('\n  Saved. Checking the cloud database (it can take up to a minute to wake up)...');
try {
  const p = await new sql.ConnectionPool({ server, port: 1433, database: db, user, password: pass, connectionTimeout: 90000, options: { encrypt: true } }).connect();
  await p.request().query('SELECT 1 AS ok');
  await p.close();
  console.log('  Connected to the cloud database.\n');
  console.log('  In Render, type these when it asks:');
  console.log(`    DB_SERVER    ${server}`);
  console.log(`    DB_NAME      ${db}`);
  console.log(`    DB_USER      ${user}`);
  console.log('    DB_PASSWORD  (your password)');
  console.log(`    ACCESS_CODE  ${code}\n`);
} catch (e) {
  console.log(`\n  Could not connect: ${e.message}`);
  console.log('  Check the server name / login / password, and in Azure > your SQL server > Networking that');
  console.log('  "Allow Azure services" is ticked and a rule allows all addresses (0.0.0.0 - 255.255.255.255).\n');
}
