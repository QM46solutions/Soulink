// Builds docs/qa/testcases/TEST-CASES.csv from cases-part*.txt (planned cases) and the latest JUnit results (executed automated cases).
// Run: node docs/qa/testcases/build.mjs <results-run-folder>
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const run = process.argv[2];
const extra = process.argv.slice(3); // more result folders whose junit.xml holds tests named "SL-<ID> ..." (QA suites)
const MODULES = { AUTH: 'Auth, OTP, sessions', FACE: 'Face ID + onboarding', DNA: 'Soul DNA', PROF: 'Profile', CONN: 'Connect / Follow', POST: 'Feed & posts', SPRK: 'Sparks', MOM: 'Moments', CHAT: 'Messaging', ANON: 'Anonymous messages', ARG: 'Argue', SRCH: 'Search & Discover', NOTF: 'Notifications & push', EVT: 'Events', MOJI: 'Soulmoji', SAFE: 'Safety', LEGL: 'Legal, copyright, grievances', SETT: 'Settings & account', BKUP: 'Data export & restore', ADS: 'Ads', SHOP: 'Shop', UPDT: 'Update App & telemetry', CNSL: 'Team console', SHAR: 'Share links', XPLT: 'Cross-platform sync', DATA: 'Database integrity', PERF: 'Performance', SECU: 'Security', A11Y: 'Accessibility', NETW: 'Network & reliability', INST: 'Install & upgrade', UI: 'UI/UX', CICD: 'CI/CD & regression' };
const TYPES = { SMK: 'Smoke', FUN: 'Functional', NEG: 'Negative', BND: 'Boundary', E2E: 'End-to-end', MU: 'Multi-user', CON: 'Concurrency', SEC: 'Security', XPL: 'Cross-platform', DB: 'Database', PRF: 'Performance', A11Y: 'Accessibility', NET: 'Network', INS: 'Installation', UI: 'UI/UX', REG: 'Regression', API: 'API', AUTO: 'Automated API (existing)' };
const envOf = (p) => { const s = []; if (/API|Web/.test(p) || p === 'All') s.push('E1 laptop'); if (/Android/.test(p) || p === 'All') s.push('E2 emulator'); if (/iOS/.test(p) || p === 'All') s.push('E3 iPhone'); return s.join(' + '); };
const rows = []; const seq = {};
const id = (m, t) => { const k = `${m}-${t}`; seq[k] = (seq[k] || 0) + 1; return `SL-${m}-${t}-${String(seq[k]).padStart(3, '0')}`; };
for (const f of fs.readdirSync(here).filter((f) => /^cases-part\d+\.txt$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(here, f), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [m, t, prio, sev, plat, scen, pre, steps, data, exp] = line.split('|');
    if (!MODULES[m] || !TYPES[t]) throw new Error(`bad module/type in: ${line}`);
    const platform = plat === 'All' ? 'Web, Android, iOS' : plat.replace(/,/g, ', ');
    rows.push({ ID: id(m, t), Module: MODULES[m], Scenario: scen, Preconditions: pre, Steps: steps, 'Test data': data, 'Expected result': exp, 'Actual result': '', Platform: platform, Environment: envOf(plat), Type: TYPES[t], Priority: prio, Severity: sev, Status: 'NOT RUN', 'Defect ID': '', Evidence: '', Automation: 'Planned' });
  }
}
// executed automated cases from the JUnit file
const SUITE = [[/^Auth|Logins|Sessions|Devices|Unfinished|review number|phone sign-in|code is shown|limits per address|email send|email counts|adding an email|login lasts|fingerprint|half-made|cannot finish its profile|email providers|which codes|newest email code/i, 'AUTH'], [/Face data|old-key faces|Onboarding/i, 'FACE'], [/Soul DNA|categories|answer shapes|gut reactions|photo pick|crossed|non-negotiables|similar calm|rare picks|older Soul DNA/i, 'DNA'], [/Requests count|Settings pages|interests and city/i, 'PROF'], [/Connect requests|Follow graph|limit interactions/i, 'CONN'], [/Shared post/i, 'SHAR'], [/Home feed|Post menu|post menu|Post offense|^Comments|who can comment|hidden words|Spread|Private file links|Music|For you/i, 'POST'], [/Spark|Casting|Open Mic/i, 'SPRK'], [/Moments/i, 'MOM'], [/Chat|Message-box|Private chat|Paid message|Group invite|Scheduled reveal|read receipts|OX game|translator|Google translator/i, 'CHAT'], [/Anonymous/i, 'ANON'], [/Argue|Referee/i, 'ARG'], [/^Search|Places/i, 'SRCH'], [/Pulse meter on\/off/i, 'NOTF'], [/Soulmoji/i, 'MOJI'], [/Safety|Bans/i, 'SAFE'], [/Copyright|Legal and privacy|complaint|court order|ban from the console/i, 'LEGL'], [/Pause and delete|Account deletion|Pulse meter|Who viewed/i, 'SETT'], [/Restore|Download My Data|expired download/i, 'BKUP'], [/Ads|hourly booking/i, 'ADS'], [/Phone app|version|update policy|crashes|slow requests|Report a problem/i, 'UPDT'], [/console team|first owner|people per hour/i, 'CNSL']];
let auto = 0;
if (run) {
  const x = fs.readFileSync(path.join(run, 'full-junit.xml'), 'utf8');
  const stack = [];
  const dec = (s) => (s || '').replace(/&amp;quot;/g, '"').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
  const tokens = [...x.matchAll(/<(\/?)(testsuite|testcase)\b([^>]*?)(\/?)>|<failure\b/g)];
  let last = null;
  for (const m of tokens) {
    if (m[0].startsWith('<failure')) { if (last) last.Status = 'FAIL'; continue; }
    const [, close, tag, attrs] = m; const name = dec((attrs.match(/name="([^"]*)"/) || [])[1]);
    if (tag === 'testsuite') { if (close) stack.pop(); else stack.push(name); continue; }
    if (close) continue;
    if (/^SL-[A-Z0-9]+-[A-Z0-9]+-\d{3}/.test(name)) { last = null; continue; } // QA tests update their planned case below
    const suite = stack[0] || ''; const key = suite || name;
    const mod = (SUITE.find(([re]) => re.test(key)) || [null, 'CICD'])[1];
    last = { ID: id(mod, 'AUTO'), Module: MODULES[mod], Scenario: suite ? `${suite}: ${name}` : name, Preconditions: 'Fresh soulink_test database (resetDb per file)', Steps: 'Automated (node:test + supertest)', 'Test data': 'Generated users (makeUser/makeDna)', 'Expected result': 'Assertions in server/test', 'Actual result': 'As expected', Platform: 'API', Environment: 'E1 laptop', Type: TYPES.AUTO, Priority: 'P1', Severity: '', Status: 'PASS', 'Defect ID': '', Evidence: `${path.basename(run)}/full-junit.xml`, Automation: 'Automated' };
    rows.push(last); auto++;
  }
}
// QA test results: newest folder last wins
for (const dir of extra) {
  const x = fs.readFileSync(path.join(dir, fs.existsSync(path.join(dir, 'junit.xml')) ? 'junit.xml' : 'full-junit.xml'), 'utf8');
  for (const m of x.matchAll(/<testcase\b[^>]*name="(SL-[A-Z0-9]+-[A-Z0-9]+-\d{3})[^"]*"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const row = rows.find((r) => r.ID === m[1]); if (!row) { console.error('no planned case for', m[1]); continue; }
    const failed = /<failure/.test(m[3] || '');
    row.Status = failed ? 'FAIL' : 'PASS'; row['Actual result'] = failed ? 'See evidence' : 'As expected';
    row.Evidence = `${path.basename(dir)}/junit.xml`; row.Automation = 'Automated (server/test/qa-p0.test.js)'; row.Environment = 'E1 laptop';
    if (m[1] === 'SL-SAFE-MU-002') row['Defect ID'] = 'SLD-001';
    if (m[1] === 'SL-CONN-CON-001') row['Defect ID'] = 'SLD-002';
  }
}
const cols = Object.keys(rows[0]);
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(here, 'TEST-CASES.csv'), '﻿' + [cols.map(q).join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\r\n'));
const by = (k) => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
console.log(JSON.stringify({ total: rows.length, planned: rows.length - auto, automatedExecuted: auto, status: by('Status'), priority: by('Priority') }));
console.log(JSON.stringify(by('Module')));
