import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/services/whatsapp";
import { getServerEnv } from "@/lib/env";

/**
 * Reminder dispatcher — invoked by Vercel Cron (see vercel.json).
 * Picks up queued reminders that are due and sends them via WhatsApp.
 * Protected by CRON_SECRET so only the scheduler can trigger it.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const auth = request.headers.get("authorization");
  if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("reminders")
    .select("id, recipient, rendered_body, channel")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso)
    .limit(100);

  const reminders = due ?? [];
  let sent = 0;
  let failed = 0;

  for (const r of reminders) {
    if (r.channel !== "whatsapp") continue;
    const result = await sendWhatsAppText(r.recipient, r.rendered_body);
    await admin
      .from("reminders")
      .update(
        result.ok
          ? { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.messageId }
          : { status: "failed", error_message: result.error }
      )
      .eq("id", r.id);
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ processed: reminders.length, sent, failed });
}
