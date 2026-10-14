// Sends one-time login codes the moment the user asks (policy section 4). Codes are never shown in the app.
//  SMS_PROVIDER=console  development: the code is printed in the server terminal
//  SMS_PROVIDER=msg91    production: MSG91 with a DLT-registered sender and template
//                        (MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID; the template uses the variable ##otp##)
// Email accounts get their code by email.
import { config } from '../config.js';
import { sendEmail } from './email.js';

const minutes = () => config.otp.ttlSeconds / 60;

async function msg91(templateId, phone, vars) {
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: phone.replace(/^\+/, ''), ...vars }] }),
  });
  if (!res.ok) throw new Error(`SMS not sent (${res.status})`);
}

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
    default:
      throw new Error(`SMS provider "${config.smsProvider}" is not set up yet`);
  }
}

/** An account notice by SMS (needs its own DLT template; skipped when none is set). */
export async function sendSmsNotice(phone, templateEnv) {
  if (config.smsProvider === 'console') { if (config.env !== 'test') console.log(`\n📱 SMS notice to ${phone}: ${templateEnv}\n`); return; }
  if (config.smsProvider === 'msg91' && process.env[templateEnv]) await msg91(process.env[templateEnv], phone, {});
}
