// Security log: one JSON line per event on stdout. In production Azure App Service sends stdout to
// Log Analytics in Central India, kept 365 days (Information Security Policy, section 8).
// Never put codes, secrets, face data or message text in here.
import { config } from '../config.js';

export function securityLog(event, fields = {}) {
  if (config.env === 'test') return;
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), type: 'security', event, ...fields })); } catch { /* never break a request over a log line */ }
}

export const clientIp = (req) => String(req?.ip || req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64) || null;
