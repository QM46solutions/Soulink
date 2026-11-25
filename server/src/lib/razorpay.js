// Razorpay (cards, UPI, net banking) for things sold outside the app stores' rules — event tickets are a real-world
// service, so Google Play / Apple allow an outside gateway for them. Keys live only on the server (Render):
//   RAZORPAY_KEY_ID      rzp_test_... while testing, rzp_live_... once the account is activated
//   RAZORPAY_KEY_SECRET  never sent to the app
// Flow: the server makes an order → Razorpay Checkout takes the money → the server checks the signature
// (HMAC of "order_id|payment_id" with the secret) and, if the person closed the page early, asks Razorpay
// whether the order was paid.
import crypto from 'node:crypto';
import { HttpError } from './errors.js';

const API = 'https://api.razorpay.com/v1';
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID || '';
export const razorpayOn = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
/** Test keys (rzp_test_...) take no real money; the app shows a TEST MODE label. */
export const razorpaySandbox = () => razorpayKeyId().startsWith('rzp_test_');

async function call(path, { method = 'GET', body } = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res;
  try {
    res = await fetch(API + path, { method, headers: { Authorization: `Basic ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  } catch { throw new HttpError(502, "Couldn't reach the payment service. Try again in a moment.", 'payment_unreachable'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[razorpay]', path, res.status, data?.error?.description || '');
    throw new HttpError(502, 'The payment service said no. Try again in a moment.', 'payment_failed');
  }
  return data;
}

/** A new order for `rupees` (whole rupees). Returns the Razorpay order (id, amount in paise, currency). */
export function createOrder(rupees, receipt, notes = {}) {
  return call('/orders', { method: 'POST', body: { amount: Math.round(rupees * 100), currency: 'INR', receipt: String(receipt).slice(0, 40), notes } });
}

/** True when Checkout's signature proves this payment belongs to this order. */
export function signatureOk(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const want = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(want); const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The captured payment of an order, if there is one (for people who closed the page before it came back). */
export async function paidPaymentOf(orderId) {
  const r = await call(`/orders/${encodeURIComponent(orderId)}/payments`);
  return (r.items || []).find((p) => p.status === 'captured') || null;
}

/** Details of one payment (to double-check the amount and order). */
export const paymentOf = (paymentId) => call(`/payments/${encodeURIComponent(paymentId)}`);
