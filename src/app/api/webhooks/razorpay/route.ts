import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/services/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Razorpay webhook → marks payments successful and updates the linked fee.
 * Uses the service role (RLS-bypassing) because the request has no user session.
 * Idempotent on razorpay_payment_id.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: { payment: { entity: Record<string, unknown> } };
  };

  const admin = createAdminClient();

  if (event.event === "payment.captured" || event.event === "payment_link.paid") {
    const payment = event.payload.payment.entity;
    const referenceId = (payment.notes as Record<string, string> | undefined)?.reference_id
      ?? (payment.order_id as string | undefined);
    const paymentId = payment.id as string;
    const amount = payment.amount as number;

    // Mark our payment row succeeded.
    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "success",
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", referenceId as string)
      .select("id, fee_id, institute_id, student_id")
      .maybeSingle();

    if (updated?.fee_id) {
      // Increment amount_paid then recompute status via RPC.
      await admin.rpc("increment_fee_payment", {
        p_fee_id: updated.fee_id,
        p_amount: amount,
      });
    }
  }

  return NextResponse.json({ received: true });
}
