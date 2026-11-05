// Payments: real money needs a payment gateway (Razorpay) set up with the company's KYC.
// Until then the laptop / test builds run every paid flow in "test" mode (nothing is charged);
// the online version says payments are coming soon.
import { config } from '../config.js';
import { HttpError } from './errors.js';

export const paymentsLive = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const testPaymentsAllowed = () => config.env !== 'production' || process.env.PAID_MESSAGE_TEST === '1' || process.env.PAYMENTS_TEST === '1';
export const paymentMode = () => (paymentsLive() ? 'live' : testPaymentsAllowed() ? 'test' : 'off');

/** Returns 'test' (or 'paid' once Razorpay is wired in), or throws when payments are off. */
export function takePayment(paymentRef) {
  const mode = paymentMode();
  if (mode === 'test') return 'test';
  if (mode === 'live') {
    // TODO: verify paymentRef with Razorpay here before granting anything
    if (!paymentRef) throw new HttpError(402, 'Payment needed', 'payment_required');
    throw new HttpError(503, "Payments aren't switched on yet.", 'payments_off');
  }
  throw new HttpError(503, 'Payments are coming soon on Soulink.', 'payments_off');
}

/** Soulink team accounts (ADMIN_USERNAMES=sairaghava.r,nikhil.cheedella) can run ads. */
export const isAdmin = (u) => !!u && (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(u.username || '').toLowerCase());
