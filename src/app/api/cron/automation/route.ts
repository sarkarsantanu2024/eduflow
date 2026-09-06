import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runDailyAutomation } from "@/features/automation/engine";
import { runMonthlyBillingForAll } from "@/features/automation/billing";

/**
 * Daily automation pass (Vercel Cron, ~9:00 IST).
 *
 * Order matters: monthly billing runs FIRST so the reminder pass can see the
 * fees it just generated. Before this, fee generation lived in a browser
 * effect on the Fees page — a center whose owner didn't open that page never
 * had fees to be reminded about, and the month went uncollected.
 *
 * Then queues fee due/overdue reminders and birthday wishes into each
 * center's outbox and purges rows that no longer earn their storage. Vercel
 * sends `Authorization: Bearer ${CRON_SECRET}` automatically when the env var
 * is set.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { CRON_SECRET } = getServerEnv();
  if (CRON_SECRET && req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const billing = await runMonthlyBillingForAll();
    const result = await runDailyAutomation();
    return NextResponse.json({ ok: true, billing, ...result });
  } catch (e) {
    console.error("[cron/automation]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
