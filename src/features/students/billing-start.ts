/**
 * When a student's monthly billing begins.
 *
 * The admission form used to assume "admitted today". That holds for a walk-in
 * and fails for the most common first-week task: typing in every student who
 * has already been attending for months. Those students were given an admission
 * fee due on their real admission date — so someone admitted in January looked
 * eight months overdue the moment they were saved — and were invoiced for the
 * current month on the day of entry.
 *
 * The rule lives here so the form and the nightly billing run cannot drift:
 * the form decides the default start, the server decides whether a given month
 * is billable, and both agree on what "started" means.
 */

/** "2026-09" → "2026-10". */
export function nextMonth(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10).slice(0, 7);
}

/**
 * Default first billed month for a new admission.
 *
 * Admitted this month or later → bill from the admission month.
 * Admitted before this month → the owner is entering an existing student, who
 * was settled up on paper, so start next month rather than invoicing them for
 * a period they already paid for offline.
 */
export function defaultBillingStart(admissionDate: string, currentYm: string): string {
  const admissionYm = (admissionDate || "").slice(0, 7);
  if (!admissionYm) return currentYm;
  if (admissionYm < currentYm) return nextMonth(currentYm);
  return admissionYm;
}

/**
 * Is `ym` on or after this student's billing start?
 *
 * `billingStartMonth` wins when set; otherwise the admission month applies, so
 * every student recorded before this field existed keeps behaving exactly as
 * they did. A student with neither is billed (a centre mid-migration should
 * not silently stop invoicing).
 */
export function billsInMonth(
  student: { admissionDate?: string | null; billingStartMonth?: string | null },
  ym: string,
): boolean {
  const start = (student.billingStartMonth || "").trim() || (student.admissionDate || "").slice(0, 7);
  return !start || start <= ym;
}
