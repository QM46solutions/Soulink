// Sends email: login codes for email accounts and account notices (deletion confirmation).
// EMAIL_PROVIDER=console (development: printed in the terminal) | resend (production: RESEND_API_KEY, EMAIL_FROM).
import { config } from '../config.js';

export async function sendEmail({ to, subject, text }) {
  switch (config.emailProvider) {
    case 'console':
      if (config.env !== 'test') console.log(`\n✉️  Email to ${to}: ${subject}\n${text}\n`);
      return;
    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text }),
      });
      if (!res.ok) throw new Error(`Email not sent (${res.status})`);
      return;
    }
    default:
      throw new Error(`Email provider "${config.emailProvider}" is not set up`);
  }
}
