// Sends one-time login codes the moment the user asks (policy section 4). Codes are never shown in the app.
//  SMS_PROVIDER=console  development: the code is printed in the server terminal
//  SMS_PROVIDER=msg91    production: MSG91 with a DLT-registered sender and template
//                        (MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID; the template uses the variable ##otp##)
//  SMS_PROVIDER=messagecentral  production without our own DLT: Message Central VerifyNow sends a code from its
//                        own approved sender and template, and checks it too (MESSAGECENTRAL_CUSTOMER_ID and
//                        MESSAGECENTRAL_PASSWORD, or MESSAGECENTRAL_KEY = the password already Base64-encoded).
//                        sendOtp then returns { ref } (their verificationId); checkProviderCode validates it.
// Email accounts get their code by email.
import { config } from '../config.js';
import { sendEmail } from './email.js';
import { HttpError, tooMany } from '../lib/errors.js';

const minutes = () => config.otp.ttlSeconds / 60;

async function msg91(templateId, phone, vars) {
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: phone.replace(/^\+/, ''), ...vars }] }),
  });
  if (!res.ok) throw new Error(`SMS not sent (${res.status})`);
}

// ---- Message Central VerifyNow ----
const MC = 'https://cpaas.messagecentral.com';
let mcToken = null; // { value, at }
const mcKey = () => process.env.MESSAGECENTRAL_KEY
  || (process.env.MESSAGECENTRAL_PASSWORD ? Buffer.from(process.env.MESSAGECENTRAL_PASSWORD).toString('base64') : '');
export const messageCentralReady = () => !!(process.env.MESSAGECENTRAL_CUSTOMER_ID && mcKey());

async function mcAuth(fresh = false) {
  if (!fresh && mcToken && Date.now() - mcToken.at < 6 * 3600e3) return mcToken.value;
  const q = new URLSearchParams({ customerId: process.env.MESSAGECENTRAL_CUSTOMER_ID || '', key: mcKey(), scope: 'NEW', country: '91' });
  const res = await fetch(`${MC}/auth/v1/authentication/token?${q}`, { headers: { accept: '*/*' }, signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(`SMS sign-in failed (${res.status})`);
  mcToken = { value: body.token, at: Date.now() };
  return body.token;
}

/** Calls Message Central once, signing in again when the saved token has expired. */
async function mcCall(method, path, params) {
  for (const fresh of [false, true]) {
    const res = await fetch(`${MC}${path}?${new URLSearchParams(params)}`, {
      method, headers: { authToken: await mcAuth(fresh), accept: '*/*' }, signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 && !fresh) { mcToken = null; continue; }
    const body = await res.json().catch(() => ({}));
    return { status: res.status, code: Number(body?.data?.responseCode ?? body?.responseCode ?? res.status), data: body?.data || {} };
  }
}

/** "+919876543210" → { countryCode: '91', mobileNumber: '9876543210' }. Only Indian numbers for now. */
function splitPhone(phone) {
  const m = /^\+91([6-9]\d{9})$/.exec(phone);
  if (!m) throw new HttpError(400, 'Phone codes can only be sent to Indian (+91) numbers right now. Please use your email address.', 'phone_country');
  return { countryCode: '91', mobileNumber: m[1] };
}

async function messageCentralSend(phone) {
  const r = await mcCall('POST', '/verification/v3/send', { ...splitPhone(phone), customerId: process.env.MESSAGECENTRAL_CUSTOMER_ID, flowType: 'SMS', otpLength: '6' });
  if (r.code === 200 && r.data.verificationId) return { ref: String(r.data.verificationId) };
  if (r.code === 506) throw tooMany('A code was just sent to this number. Please wait a minute and try again.');
  if (r.code === 800) throw tooMany('Too many codes were requested for this number. Please try again later.');
  throw new Error(`SMS not sent (${r.status}/${r.code})`);
}

/** Checks a code that Message Central created. Returns 'ok' | 'wrong' | 'expired' | 'limit'. */
export async function checkProviderCode(ref, code) {
  const r = await mcCall('GET', '/verification/v3/validateOtp', { verificationId: ref, code: String(code) });
  if (r.code === 200 && (!r.data.verificationStatus || r.data.verificationStatus === 'VERIFICATION_COMPLETED')) return 'ok';
  if (r.code === 702 || r.code === 700) return 'wrong';
  if (r.code === 705 || r.code === 703 || r.code === 505) return 'expired';
  if (r.code === 800) return 'limit';
  throw new HttpError(503, "We couldn't check the code right now. Please try again in a minute.", 'otp_check_failed');
}

/** Sends a login code. Returns { ref } when the provider made the code itself (Message Central), otherwise nothing. */
export async function sendOtp({ target, channel, code }) {
  if (channel === 'email') {
    return sendEmail({ to: target, subject: `${code} is your Soulink code`, text: `Your Soulink login code is ${code}. It expires in ${minutes()} minutes.\n\nNever share this code with anyone. Soulink will never ask you for it.` });
  }
  switch (config.smsProvider) {
    case 'console':
      if (config.env !== 'test') console.log(`\n🔐 OTP for ${channel} ${target}: ${code}  (valid ${minutes()} min)\n`);
      return;
    case 'msg91':
      return msg91(process.env.MSG91_OTP_TEMPLATE_ID, target, { otp: code });
    case 'messagecentral':
      return messageCentralSend(target);
    default:
      throw new Error(`SMS provider "${config.smsProvider}" is not set up yet`);
  }
}

/** An account notice by SMS (needs its own DLT template; skipped when none is set, and with Message Central, which sends codes only). */
export async function sendSmsNotice(phone, templateEnv) {
  if (config.smsProvider === 'console') { if (config.env !== 'test') console.log(`\n📱 SMS notice to ${phone}: ${templateEnv}\n`); return; }
  if (config.smsProvider === 'msg91' && process.env[templateEnv]) await msg91(process.env[templateEnv], phone, {});
}
