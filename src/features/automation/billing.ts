import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, fees, institutes, students, teachers } from "@/lib/db/schema";
import { effectiveFee, type RecurringCharge } from "@/lib/store/types";
import { istToday } from "@/features/automation/engine";
import { billsInMonth } from "@/features/students/billing-start";

/**
 * Monthly billing: the month's fee for every active student, plus the recurring
 * charges and teacher-salary expenses that make Net Profit the center's real
 * margin.
 *
 * WHY THIS IS SERVER-SIDE
 * This used to be three `useEffect` hooks on the Fees page. They deduped by
 * scanning the browser's own cached copy of the data, which meant:
 *   - two tabs (or a phone and a laptop) both saw "no fee yet" and both
 *     inserted — a duplicate charge against a real parent;
 *   - if nobody opened the Fees page in a month, no fees existed at all, so
 *     the nightly reminder pass had nothing to remind anyone about and the
 *     month simply went uncollected;
 *   - an optimistic write that failed was never retried, because the effect's
 *     in-memory guard had already marked that student as done.
 *
 * IDEMPOTENCY
 * Guarded twice, deliberately. `onConflictDoNothing` against the partial
 * unique indexes (`fees_monthly_unique`, `expenses_auto_unique`) is the real
 * guarantee — it holds even if two cron runs and a page load collide. The
 * pre-reads below just avoid pointless insert attempts.
 *
 * Runs from two places: the daily cron for every active center, and on demand
 * when an owner opens Fees, so a center that signed up this morning does not
 * wait until tomorrow to see its fees.
 */

export interface BillingResult {
  feesCreated: number;
  expensesCreated: number;
  suspended: number;
}

/**
 * Unpaid months after which service is suspended. Kept in step with
 * DEACTIVATE_AFTER in the Fees screen, which shows the owner the same rule.
 */
const SUSPEND_AFTER_UNPAID_MONTHS = 4;

/** "2026-09" → "September 2026". Fixed to en-IN so cron and UI agree. */
function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Generate this month's fees and auto-expenses for one center.
 * Safe to call repeatedly — that is the point.
 */
export async function runMonthlyBilling(instituteId: string): Promise<BillingResult> {
  const { ymd } = istToday();
  const ym = ymd.slice(0, 7);
  const label = monthLabel(ym);

  const inst = await db.query.institutes.findFirst({ where: eq(institutes.id, instituteId) });
  if (!inst) return { feesCreated: 0, expensesCreated: 0, suspended: 0 };

  const centerFee = inst.monthlyFee ?? 0;

  const activeStudents = await db
    .select()
    .from(students)
    .where(and(eq(students.instituteId, instituteId), isNull(students.deletedAt), eq(students.status, "active")));

  /* ── 1. One monthly fee per active student ─────────────────────── */
  const existing = await db
    .select({ studentId: fees.studentId })
    .from(fees)
    .where(and(eq(fees.instituteId, instituteId), eq(fees.kind, "monthly"), eq(fees.period, ym), isNull(fees.deletedAt)));
  const alreadyBilled = new Set(existing.map((f) => f.studentId));

  /**
   * A student is billed only once their billing has started — see
   * features/students/billing-start.ts for the rule. This is what stops a
   * centre's first week of data entry producing a pile of fake dues, and it
   * also covers a future-dated admission (enrolled now for a batch that
   * begins next month).
   */
  const feeRows = activeStudents
    .filter((s) => billsInMonth(s, ym))
    .filter((s) => !alreadyBilled.has(s.id))
    .map((s) => ({
      instituteId,
      studentId: s.id,
      studentName: `${s.firstName} ${s.lastName ?? ""}`.trim(),
      parentMobile: s.parentMobile || s.fatherContact || "",
      kind: "monthly",
      period: ym,
      title: `${label} Monthly Fee`,
      type: "monthly",
      amount: effectiveFee(s, centerFee),
      amountPaid: 0,
      status: "pending" as const,
      // Never dated in the past. The cron normally runs early in the month so
      // the 5th is still ahead, but a centre that signs up on the 20th calls
      // this on demand — and a fee born overdue would fire an "overdue"
      // reminder at a parent who has not been asked for the money yet.
      dueDate: `${ym}-05` > ymd ? `${ym}-05` : ymd,
    }));

  let feesCreated = 0;
  if (feeRows.length) {
    const inserted = await db
      .insert(fees)
      .values(feeRows)
      .onConflictDoNothing({ target: [fees.instituteId, fees.studentId, fees.period] })
      .returning({ id: fees.id });
    feesCreated = inserted.length;
  }

  /* ── 2. Recurring charges + teacher salary, as expenses ────────── */
  const charges: RecurringCharge[] = inst.recurringCharges ?? [];
  const feeBase = activeStudents.reduce((sum, s) => sum + effectiveFee(s, centerFee), 0);

  type ExpenseInsert = typeof expenses.$inferInsert;
  const expenseRows: ExpenseInsert[] = [];

  for (const c of charges) {
    const amount =
      c.basis === "fixed" ? c.amount
      : c.basis === "per_student" ? c.amount * activeStudents.length
      : Math.round((c.amount / 100) * feeBase);
    if (amount <= 0) continue;
    expenseRows.push({
      instituteId,
      title: `${c.name || "Charge"} — ${label}`,
      category: c.category || "Miscellaneous",
      amount,
      date: ymd,
      note:
        c.basis === "per_student" ? `₹${c.amount} × ${activeStudents.length} active students`
        : c.basis === "percent" ? `${c.amount}% of ₹${feeBase} monthly fees`
        : "fixed monthly charge",
      // Stable across re-runs and independent of the title, so renaming a
      // charge cannot cause it to be posted a second time in the same month.
      dedupeKey: `charge:${c.id}:${ym}`,
    });
  }

  const staff = await db
    .select({ salary: teachers.salary })
    .from(teachers)
    .where(and(eq(teachers.instituteId, instituteId), isNull(teachers.deletedAt)));
  const salaryTotal = staff.reduce((sum, t) => sum + (t.salary || 0), 0);
  if (salaryTotal > 0) {
    const paidCount = staff.filter((t) => (t.salary || 0) > 0).length;
    expenseRows.push({
      instituteId,
      title: `Teacher salary — ${label}`,
      category: "Teacher Salary",
      amount: salaryTotal,
      date: ymd,
      note: `${paidCount} teacher${paidCount > 1 ? "s" : ""}`,
      dedupeKey: `salary:${ym}`,
    });
  }

  let expensesCreated = 0;
  if (expenseRows.length) {
    const inserted = await db
      .insert(expenses)
      .values(expenseRows)
      .onConflictDoNothing({ target: [expenses.instituteId, expenses.dedupeKey] })
      .returning({ id: expenses.id });
    expensesCreated = inserted.length;
  }

  /* ── 3. Suspend service after too many unpaid months ───────────── */
  //
  // Ran in a Fees-page browser effect before, so it fired whenever somebody
  // happened to open that screen, and it counted every unpaid monthly fee ever
  // recorded — including months before the centre started billing a student,
  // which meant entering a long-standing student could suspend them on sight.
  //
  // Only months from the student's billing start count now, and it runs once a
  // day from the cron whether or not anyone opens the app.
  const unpaid = await db
    .select({ studentId: fees.studentId, period: fees.period })
    .from(fees)
    .where(and(
      eq(fees.instituteId, instituteId),
      eq(fees.kind, "monthly"),
      ne(fees.status, "paid"),
      isNull(fees.deletedAt),
    ));

  const unpaidByStudent = new Map<string, string[]>();
  for (const f of unpaid) {
    if (!f.studentId) continue;
    const list = unpaidByStudent.get(f.studentId) ?? [];
    list.push(f.period);
    unpaidByStudent.set(f.studentId, list);
  }

  const toSuspend = activeStudents.filter((s) => {
    const periods = unpaidByStudent.get(s.id) ?? [];
    // Anything before this student's billing start is not a debt they owe.
    const countable = periods.filter((period) => billsInMonth(s, period));
    return countable.length >= SUSPEND_AFTER_UNPAID_MONTHS;
  });

  let suspended = 0;
  if (toSuspend.length) {
    const ids = toSuspend.map((s) => s.id);
    const done = await db
      .update(students)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(students.instituteId, instituteId), inArray(students.id, ids)))
      .returning({ id: students.id });
    suspended = done.length;
    console.info(`[billing] suspended ${suspended} student(s) at ${instituteId} for ${SUSPEND_AFTER_UNPAID_MONTHS}+ unpaid months`);
  }

  return { feesCreated, expensesCreated, suspended };
}

/** Run monthly billing for every active center. Called by the daily cron. */
export async function runMonthlyBillingForAll(): Promise<BillingResult & { centers: number }> {
  const centers = await db
    .select({ id: institutes.id })
    .from(institutes)
    .where(eq(institutes.isActive, true));

  let feesCreated = 0;
  let expensesCreated = 0;
  let suspended = 0;
  for (const c of centers) {
    try {
      const r = await runMonthlyBilling(c.id);
      feesCreated += r.feesCreated;
      expensesCreated += r.expensesCreated;
      suspended += r.suspended;
    } catch (e) {
      // One center's billing must never stop the rest of the run.
      console.error(`[billing] center ${c.id} failed:`, e);
    }
  }
  return { centers: centers.length, feesCreated, expensesCreated, suspended };
}
