import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getServerEnv } from "@/lib/env";

let _client: Razorpay | null = null;

function client(): Razorpay {
  if (_client) return _client;
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay not configured");
  }
  _client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return _client;
}

/** Create a hosted payment link for a fee. `amount` is in paise. */
export async function createPaymentLink(params: {
  amount: number;
  referenceId: string; // our payment row id
  customer: { name: string; contact?: string; email?: string };
  description: string;
}): Promise<{ id: string; shortUrl: string }> {
  const link = await client().paymentLink.create({
    amount: params.amount,
    currency: "INR",
    accept_partial: false,
    reference_id: params.referenceId,
    description: params.description,
    customer: {
      name: params.customer.name,
      contact: params.customer.contact,
      email: params.customer.email,
    },
    notify: { sms: true, email: Boolean(params.customer.email) },
    reminder_enable: true,
  });
  return { id: link.id as string, shortUrl: link.short_url as string };
}

/** Verify a Razorpay checkout signature (order_id|payment_id). */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { RAZORPAY_KEY_SECRET } = getServerEnv();
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET!)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
}

/** Verify the X-Razorpay-Signature header on a webhook payload. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const { RAZORPAY_WEBHOOK_SECRET } = getServerEnv();
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
