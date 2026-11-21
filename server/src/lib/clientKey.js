// Who is this request from, for rate limits. Through the phone link (cloudflared -> local gateway) every phone
// reaches the server from this laptop (127.0.0.1); Cloudflare tells us the real phone's address in cf-connecting-ip.
// That header is trusted only when the request came from this laptop itself (the gateway).
import { ipKeyGenerator } from 'express-rate-limit';

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
// On Render, requests pass through Cloudflare and Render's own proxies, so req.ip is a shared proxy address:
// every tester in the same city counted as ONE person and they hit each other's limits (429). Render sits
// behind Cloudflare, which sets cf-connecting-ip / true-client-ip to the real phone's address.
const BEHIND_CDN = !!process.env.RENDER;
export function clientKey(req) {
  const cf = req.get('cf-connecting-ip') || (BEHIND_CDN ? req.get('true-client-ip') : null);
  const ip = cf && (BEHIND_CDN || LOCAL.has(req.socket.remoteAddress)) ? cf : req.ip;
  return ipKeyGenerator(ip || 'unknown');
}

/** For routes that need a login: limits count per account, so people on the same network never share them. */
export const userKey = (req) => (req.user?.id ? `u:${req.user.id}` : clientKey(req));

/** What a rate-limited request answers, in the shape the app shows to people. */
export const limitedMessage = { error: { code: 'rate_limited', message: 'Too many tries in a short time. Please wait a minute and try again.' } };
