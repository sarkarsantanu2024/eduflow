"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { fees, institutes, messageOutbox, payments, students } from "@/lib/db/schema";
import { requireProfile } from "@/lib/auth";
import { requireActiveInstituteId } from "@/lib/tenant";
import { renderTemplate } from "@/lib/wa-link";
import { DEFAULT_AUTOMATION, type AutomationSettings } from "@/lib/store/types";
import { enqueue, istToday, normalizeSettings, queueForInstitute, templatesByType } from "./engine";
import { runMonthlyBilling, type BillingResult } from "./billing";

/**
 * Generate this month's fees and auto-expenses for the active center, now.
 *
 * The daily cron does this for every center, but a center that signed up this
 * morning shouldn't wait until tomorrow to see its fee list — so the Fees page
 * calls this once on mount. It is idempotent at the database level (see
 * billing.ts), so calling it from several tabs at once is harmless.
 */
export async function ensureMonthlyBilling(): Promise<BillingResult> {
  const instituteId = await requireActiveInstituteId();
  return runMonthlyBilling(instituteId);
}

export type OutboxRow = {
  id: string;
  studentName: string;
  phone: string;
  kind: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
};

export type AutomationData = {
  settings: AutomationSettings;
  queued: OutboxRow[];
  sentRecently: number; // last 7 days, for the little "working" signal
};

function toRow(r: typeof messageOutbox.$inferSelect): OutboxRow {
  return {
    id: r.id, studentName: r.studentName, phone: r.phone, kind: r.kind, body: r.body,
    status: r.status, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null,
  };
}

/** Settings + the queue for the Automation panel on the Reminders page. */
export async function getAutomationData(): Promise<AutomationData> {
  const instituteId = await requireActiveInstituteId();
  const inst = await db.query.institutes.findFirst({ where: eq(institutes.id, instituteId) });
  const queued = await db.select().from(messageOutbox)
    .where(and(eq(messageOutbox.instituteId, instituteId), eq(messageOutbox.status, "queued")))
    .orderBy(desc(messageOutbox.createdAt))
    .limit(200);
  const sent = await db.select({ id: messageOutbox.id }).from(messageOutbox)
    .where(and(eq(messageOutbox.instituteId, instituteId), eq(messageOutbox.status, "sent")));
  return {
    settings: normalizeSettings(inst?.automation),
    queued: queued.map(toRow),
    sentRecently: sent.length,
  };
}

/** Owner-only: flip the automation switches. */
export async function saveAutomationSettings(patch: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const profile = await requireProfile();
  // Owner, platform admin, or the head office managing this center.
  if (profile.role === "teacher" || profile.role === "parent") {
    throw new Error("Only the center owner can change automation settings");
  }
  const instituteId = await requireActiveInstituteId();
  const inst = await db.query.institutes.findFirst({ where: eq(institutes.id, instituteId) });
  const next: AutomationSettings = {
    ...DEFAULT_AUTOMATION, ...normalizeSettings(inst?.automation), ...patch,
    feeDueDays: Math.min(14, Math.max(0, Number(patch.feeDueDays ?? normalizeSettings(inst?.automation).feeDueDays) || 0)),
  };
  await db.update(institutes).set({ automation: next }).where(eq(institutes.id, instituteId));
  // Fill the Outbox right away so a newly enabled rule shows results instantly
  // instead of waiting for tomorrow's cron. Dedupe keys make this idempotent.
  if (next.feeDue || next.feeOverdue || next.birthday) {
    await queueForInstitute({ id: instituteId, name: inst?.name ?? "our institute", automation: next });
  }
  return next;
}

/** Stamp a queued message as sent (called when the owner taps the wa.me link). */
export async function markOutboxSent(id: string): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  await db.update(messageOutbox)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(messageOutbox.id, id), eq(messageOutbox.instituteId, instituteId)));
}

/** Remove a queued message the owner doesn't want to send (hard delete — lean). */
export async function dismissOutboxItem(id: string): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  await db.delete(messageOutbox)
    .where(and(eq(messageOutbox.id, id), eq(messageOutbox.instituteId, instituteId)));
}

/** Empty the whole queue. */
export async function clearOutbox(): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  await db.delete(messageOutbox)
    .where(and(eq(messageOutbox.instituteId, instituteId), eq(messageOutbox.status, "queued")));
}

/**
 * "The parent already paid — I just never entered it." One tap on a queued fee
 * reminder records the outstanding balance as collected (fee → paid + a payment
 * row, exactly like the Fees page does) and removes the reminder, so no message
 * goes out for money already received.
 */
export async function markFeePaidFromOutbox(
  outboxId: string,
  method: "cash" | "upi" = "cash",
): Promise<{ error?: string; ok?: boolean }> {
  const instituteId = await requireActiveInstituteId();
  const row = await db.query.messageOutbox.findFirst({
    where: and(eq(messageOutbox.id, outboxId), eq(messageOutbox.instituteId, instituteId)),
  });
  if (!row || (row.kind !== "fee_due" && row.kind !== "fee_overdue")) return { error: "Not a fee reminder" };

  const feeId = row.dedupeKey.split(":")[1] ?? "";
  const fee = await db.query.fees.findFirst({ where: and(eq(fees.id, feeId), eq(fees.instituteId, instituteId)) });
  if (!fee) return { error: "Fee record not found" };

  const remaining = Math.max(0, fee.amount - fee.amountPaid);
  if (remaining > 0) {
    // Atomic: marking the fee paid and recording the payment must both happen
    // or neither. Split across two statements, a failure between them left the
    // fee reading as collected with no payment row — money that shows as
    // received on the student's balance but is missing from the collection
    // report and the P&L.
    await db.transaction(async (tx) => {
      await tx.update(fees).set({ amountPaid: fee.amount, status: "paid" }).where(eq(fees.id, fee.id));
      await tx.insert(payments).values({
        instituteId, studentId: fee.studentId, studentName: fee.studentName,
        amount: remaining, method, status: "success", source: "fee", date: istToday().ymd,
      });
    });
  }
  await db.delete(messageOutbox).where(eq(messageOutbox.id, row.id));
  return { ok: true };
}

/** Tiny stable hash so re-queuing the SAME announcement is a no-op (dedupe). */
function hashBody(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Queue an announcement for EVERY active student's parent individually —
 * the reliable alternative to a group post (groups can't be posted to by any
 * app; parents also often mute them). Deduped per student per wording per day.
 */
export async function queueAnnouncement(body: string): Promise<number> {
  const text = body.trim();
  if (!text) return 0;
  const profile = await requireProfile();
  if (profile.role === "teacher" || profile.role === "parent") {
    throw new Error("Only the center owner can queue announcements");
  }
  const instituteId = await requireActiveInstituteId();
  const rows = await db.select().from(students)
    .where(and(eq(students.instituteId, instituteId), eq(students.status, "active"), isNull(students.deletedAt)));

  const { ymd } = istToday();
  const h = hashBody(text);
  const inserts = rows.map((st) => ({
    instituteId, studentId: st.id, studentName: `${st.firstName} ${st.lastName}`.trim(),
    phone: st.parentMobile || st.fatherContact || "",
    kind: "announce",
    body: text,
    dedupeKey: `announce:${ymd}:${h}:${st.id}`,
  }));
  await enqueue(inserts);
  return inserts.filter((i) => i.phone).length;
}

/**
 * Queue "Absent Today" alerts right after attendance is saved. Fire-and-forget
 * from the attendance screen; a no-op unless the center enabled the rule and
 * has an 'absent' template. Deduped per student per day.
 */
export async function queueAbsentAlerts(date: string, absentStudentIds: string[]): Promise<number> {
  if (!absentStudentIds.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 0;
  const instituteId = await requireActiveInstituteId();
  const inst = await db.query.institutes.findFirst({ where: eq(institutes.id, instituteId) });
  const settings = normalizeSettings(inst?.automation);
  if (!settings.absent) return 0;

  const tpl = await templatesByType(instituteId, ["absent"]);
  const body = tpl.get("absent");
  if (!body) return 0;

  // Only alert for today's attendance — backfilled past dates stay quiet.
  if (date !== istToday().ymd) return 0;

  const rows = await db.select().from(students)
    .where(and(eq(students.instituteId, instituteId), inArray(students.id, absentStudentIds), isNull(students.deletedAt)));

  const inserts = rows.map((st) => ({
    instituteId, studentId: st.id, studentName: `${st.firstName} ${st.lastName}`.trim(),
    phone: st.parentMobile || st.fatherContact || "",
    kind: "absent",
    body: renderTemplate(body, {
      student_name: st.firstName,
      parent_name: st.parentName || st.fatherName || "Parent",
      business: inst?.name ?? "our institute",
    }),
    dedupeKey: `absent:${st.id}:${date}`,
  }));
  await enqueue(inserts);
  return inserts.filter((i) => i.phone).length;
}
