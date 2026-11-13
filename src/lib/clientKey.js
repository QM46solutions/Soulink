// Who is this request from, for rate limits. Through the phone link (cloudflared -> local gateway) every phone
// reaches the server from this laptop (127.0.0.1); Cloudflare tells us the real phone's address in cf-connecting-ip.
// That header is trusted only when the request came from this laptop itself (the gateway).
import { ipKeyGenerator } from 'express-rate-limit';

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function clientKey(req) {
  const cf = req.get('cf-connecting-ip');
  const ip = cf && LOCAL.has(req.socket.remoteAddress) ? cf : req.ip;
  return ipKeyGenerator(ip || 'unknown');
}
