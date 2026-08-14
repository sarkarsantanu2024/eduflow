import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fees, institutes, messageOutbox, students, templates } from "@/lib/db/schema";
import { renderTemplate } from "@/lib/wa-link";
import { formatDate } from "@/lib/utils";
import { DEFAULT_AUTOMATION, type AutomationSettings } from "@/lib/store/types";

/**
 * Phase-1 automation engine: scans fees + birthdays once a day and queues
 * rendered WhatsApp messages into `message_outbox`. Nothing is auto-sent —
 * the owner reviews the Outbox and taps send (free wa.me flow).
 *
 * Storage discipline: the (institute_id, dedupe_key) unique index means each
 * reminder can only ever exist once, inserts skip students without a phone
 * number, and `purgeOutbox` removes sent/stale rows so the table stays small.
 */

/** Today's date parts in IST (the server runs in UTC on Vercel). */
export function istToday(): { ymd: string; mmdd: string; year: number } {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const ymd = ist.toISOString().slice(0, 10);
  return { ymd, mmdd: ymd.slice(5), year: ist.getUTCFullYear() };
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeSettings(raw: AutomationSettings | null | undefined): AutomationSettings {
  return { ...DEFAULT_AUTOMATION, ...(raw ?? {}) };
}

type OutboxInsert = typeof messageOutbox.$inferInsert;

/** Insert rows, silently skipping any reminder already queued/sent before. */
export async function enqueue(rows: OutboxInsert[]): Promise<void> {
  const valid = rows.filter((r) => r.phone && r.body);
  if (!valid.length) return;
  await db.insert(messageOutbox).values(valid)
    .onConflictDoNothing({ target: [messageOutbox.instituteId, messageOutbox.dedupeKey] });
}

/** Templates of the given types for one institute, keyed by type. */
export async function templatesByType(instituteId: string, types: string[]): Promise<Map<string, string>> {
  if (!types.length) return new Map();
  const rows = await db
    .select({ type: templates.type, body: templates.body })
    .from(templates)
    .where(and(eq(templates.instituteId, instituteId), inArray(templates.type, types), isNull(templates.deletedAt)));
  return new Map(rows.map((r) => [r.type, r.body]));
}

/** Queue fee reminders (due-soon + overdue) for one institute. */
async function queueFeeReminders(
  instituteId: string, business: string, s: AutomationSettings, tpl: Map<string, string>, today: string,
): Promise<number> {
  const wantDue = s.feeDue && tpl.has("fee_due");
  const wantOverdue = s.feeOverdue && tpl.has("fee_overdue");
  if (!wantDue && !wantOverdue) return 0;

  const dueTarget = addDays(today, Math.max(0, s.feeDueDays));
  // Overdue window: past due but not ancient — never spam months-old fees the
  // day a center switches automation on.
  const overdueFloor = addDays(today, -30);

  const rows = await db
    .select({
      id: fees.id, studentId: fees.studentId, studentName: fees.studentName,
      feeMobile: fees.parentMobile, amount: fees.amount, amountPaid: fees.amountPaid,
      dueDate: fees.dueDate, status: fees.status,
      parentName: students.parentName, fatherName: students.fatherName,
      parentMobile: students.parentMobile, fatherContact: students.fatherContact,
      firstName: students.firstName,
    })
    .from(fees)
    .leftJoin(students, eq(fees.studentId, students.id))
    .where(and(
      eq(fees.instituteId, instituteId),
      isNull(fees.deletedAt),
      ne(fees.status, "paid"),
      wantDue && wantOverdue ? and(gte(fees.dueDate, overdueFloor), lte(fees.dueDate, dueTarget))
        : wantDue ? eq(fees.dueDate, dueTarget)
        : and(gte(fees.dueDate, overdueFloor), lt(fees.dueDate, today)),
    ));

  const out: OutboxInsert[] = [];
  for (const f of rows) {
    const overdue = f.dueDate !== null && f.dueDate < today;
    if (overdue ? !wantOverdue : !(wantDue && f.dueDate === dueTarget)) continue;
    const kind = overdue ? "fee_overdue" : "fee_due";
    const vars = {
      student_name: f.firstName || f.studentName || "your child",
      parent_name: f.parentName || f.fatherName || "Parent",
      amount: String(Math.max(0, f.amount - f.amountPaid)),
      due_date: formatDate(f.dueDate),
      business,
    };
    out.push({
      instituteId, studentId: f.studentId, studentName: f.studentName,
      phone: f.feeMobile || f.parentMobile || f.fatherContact || "",
      kind, body: renderTemplate(tpl.get(kind)!, vars), dedupeKey: `${kind}:${f.id}`,
    });
  }
  await enqueue(out);
  return out.length;
}

/** Queue birthday wishes for one institute. */
async function queueBirthdays(
  instituteId: string, business: string, tpl: Map<string, string>, mmdd: string, year: number,
): Promise<number> {
  const body = tpl.get("birthday");
  if (!body) return 0;
  const rows = await db
    .select()
    .from(students)
    .where(and(
      eq(students.instituteId, instituteId),
      eq(students.status, "active"),
      isNull(students.deletedAt),
      sql`to_char(${students.dob}, 'MM-DD') = ${mmdd}`,
    ));
  const out: OutboxInsert[] = rows.map((st) => ({
    instituteId, studentId: st.id, studentName: `${st.firstName} ${st.lastName}`.trim(),
    phone: st.parentMobile || st.fatherContact || "",
    kind: "birthday",
    body: renderTemplate(body, {
      student_name: st.firstName,
      parent_name: st.parentName || st.fatherName || "Parent",
      business,
    }),
    dedupeKey: `birthday:${st.id}:${year}`,
  }));
  await enqueue(out);
  return out.length;
}

/** Delete rows that no longer earn their storage. */
export async function purgeOutbox(): Promise<void> {
  // Sent >60 days ago — history nobody revisits.
  await db.execute(sql`delete from message_outbox where status = 'sent' and sent_at < now() - interval '60 days'`);
  // Still queued after 45 days — stale, the moment has passed.
  await db.execute(sql`delete from message_outbox where status = 'queued' and created_at < now() - interval '45 days'`);
  // Queued fee reminders whose fee has since been paid or trashed — obsolete.
  await db.execute(sql`
    delete from message_outbox o
    where o.status = 'queued' and o.kind in ('fee_due', 'fee_overdue')
      and not exists (
        select 1 from fees f
        where f.id::text = split_part(o.dedupe_key, ':', 2)
          and f.status <> 'paid' and f.deleted_at is null
      )`);
}

/** Run the fee + birthday scan for ONE center. Used by the daily cron and
 *  immediately when a rule is switched on, so the Outbox fills right away. */
export async function queueForInstitute(c: {
  id: string; name: string; automation: AutomationSettings | null;
}): Promise<number> {
  const s = normalizeSettings(c.automation);
  if (!s.feeDue && !s.feeOverdue && !s.birthday) return 0;
  const { ymd, mmdd, year } = istToday();
  const tpl = await templatesByType(c.id, ["fee_due", "fee_overdue", "birthday"]);
  let queued = await queueFeeReminders(c.id, c.name, s, tpl, ymd);
  if (s.birthday) queued += await queueBirthdays(c.id, c.name, tpl, mmdd, year);
  return queued;
}

/** The daily pass over every center that switched automation on. */
export async function runDailyAutomation(): Promise<{ centers: number; queued: number }> {
  const centers = await db
    .select({ id: institutes.id, name: institutes.name, automation: institutes.automation })
    .from(institutes)
    .where(and(eq(institutes.isActive, true), sql`${institutes.automation} is not null`));

  let queued = 0;
  for (const c of centers) queued += await queueForInstitute(c);

  await purgeOutbox();
  return { centers: centers.length, queued };
}
