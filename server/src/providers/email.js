// Sends email (login codes, add-email codes, account notices) through one interface, sendEmail({ to, subject,
// text }), so the provider can change without touching sign-in code. Runs on the server only; keys never reach the app.
//
//   EMAIL_PROVIDER = console  development only: printed in the server log (never counts as delivered)
//                  | resend   Resend API: RESEND_API_KEY, EMAIL_FROM (address on a domain verified in Resend)
//                  | gmail    Gmail API from a Google Workspace mailbox, via a service account with domain-wide
//                             delegation (scope gmail.send only): GMAIL_SERVICE_ACCOUNT (the key file's JSON,
//                             base64), GMAIL_SENDER (the Workspace mailbox it sends as), EMAIL_FROM (that mailbox)
//   EMAIL_FALLBACK_PROVIDER   optional second provider, tried once if the first one fails
//
// Errors never include keys or message bodies (codes are in the body).
import crypto from 'node:crypto';
import { config } from '../config.js';

const TIMEOUT_MS = 10_000;

const providers = {
  async console({ to, subject, text }) {
    if (config.env !== 'test') console.log(`\n✉️  Email to ${to}: ${subject}\n${text}\n`);
  },

  async resend({ to, subject, text }) {
    if (!process.env.RESEND_API_KEY) throw new Error('Email not sent (RESEND_API_KEY missing)');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Email not sent (resend ${res.status})`);
  },

  async gmail({ to, subject, text }) {
    const token = await gmailToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: b64url(mime({ from: config.emailFrom, to, subject, text })) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401) gmailCache = null;
    if (!res.ok) throw new Error(`Email not sent (gmail ${res.status})`);
  },
};

export const EMAIL_PROVIDERS = Object.keys(providers);

/** Sends one email; tries EMAIL_FALLBACK_PROVIDER once if the main provider fails. Throws if nothing sent it. */
export async function sendEmail(msg) {
  const order = [config.emailProvider, config.emailFallbackProvider].filter((p, i, a) => p && a.indexOf(p) === i);
  let last;
  for (const name of order) {
    const send = providers[name];
    if (!send) { last = new Error(`Email provider "${name}" is not set up`); continue; }
    try { await send(msg); return name; } catch (e) {
      last = e;
      if (config.env !== 'test') console.error(`✉️  ${e.message}${order.length > 1 ? ' (trying the next provider)' : ''}`);
    }
  }
  throw last || new Error('Email not sent');
}

/** Problems with the email settings (setting names only, never values). Checked at start-up. */
export function emailConfigProblems() {
  const p = [];
  for (const name of [config.emailProvider, config.emailFallbackProvider].filter(Boolean)) {
    if (!providers[name]) { p.push(`EMAIL_PROVIDER "${name}" is unknown (use ${EMAIL_PROVIDERS.join(' | ')})`); continue; }
    if (name === 'resend' && !process.env.RESEND_API_KEY) p.push('RESEND_API_KEY is missing');
    if (name === 'gmail' && (!process.env.GMAIL_SERVICE_ACCOUNT || !process.env.GMAIL_SENDER)) p.push('GMAIL_SERVICE_ACCOUNT and GMAIL_SENDER are needed for gmail');
  }
  return p;
}

// ---- Gmail API: service account + domain-wide delegation, scope gmail.send only ----
let gmailCache = null; // { token, exp }
async function gmailToken() {
  if (gmailCache && gmailCache.exp > Date.now() + 60_000) return gmailCache.token;
  let key;
  try { key = JSON.parse(Buffer.from(process.env.GMAIL_SERVICE_ACCOUNT || '', 'base64').toString('utf8')); } catch { key = null; }
  if (!key?.client_email || !key?.private_key || !process.env.GMAIL_SENDER) throw new Error('Email not sent (gmail settings missing)');
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: key.client_email, sub: process.env.GMAIL_SENDER, scope: 'https://www.googleapis.com/auth/gmail.send', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  const assertion = `${unsigned}.${b64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Email not sent (gmail sign-in ${res.status})`);
  const j = await res.json();
  gmailCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return gmailCache.token;
}

const b64url = (v) => Buffer.from(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const headerText = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ');
/** A plain-text RFC 5322 message (header injection blocked: no line breaks in headers). */
export function mime({ from, to, subject, text }) {
  return [
    `From: ${oneLine(from)}`, `To: ${oneLine(to)}`, `Subject: ${headerText(oneLine(subject))}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(text).toString('base64'),
  ].join('\r\n');
}
