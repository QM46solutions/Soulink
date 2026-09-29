import { config } from '../config.js';

/**
 * Sends a one-time code. Local development uses the console provider (free):
 * the code is printed in the server terminal. Add msg91 / firebase here at cloud move.
 */
export async function sendOtp({ target, channel, code }) {
  switch (config.smsProvider) {
    case 'console':
      if (config.env !== 'test') console.log(`\n🔐 OTP for ${channel} ${target}: ${code}  (valid ${config.otp.ttlSeconds / 60} min)\n`);
      return;
    default:
      throw new Error(`SMS provider "${config.smsProvider}" is not set up yet`);
  }
}
