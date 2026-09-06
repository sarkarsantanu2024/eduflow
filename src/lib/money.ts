/**
 * Fee and payment arithmetic.
 *
 * These functions used to live inside the Fees screen, which meant the most
 * consequential code in the product — deciding which fee a parent's money pays
 * off — could not be tested without a browser. They are pure now: given fees
 * and an amount, they return what should change. The screen performs the
 * writes; this decides them.
 *
 * All amounts are WHOLE RUPEES (integers), matching the database.
 */

export interface PayableFee {
  id: string;
  /** "YYYY-MM" for monthly fees, "" otherwise. */
  period: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
}

export type FeeStatus = "paid" | "partial" | "pending" | "overdue";

export interface Allocation {
  id: string;
  amountPaid: number;
  status: FeeStatus;
}

export interface AllocationResult {
  /** Per-fee changes to apply. Only fees actually touched appear here. */
  allocations: Allocation[];
  /** What was really taken — never more than is owed. */
  collected: number;
}

/** What is still owed on one fee, never negative. */
export function dueOn(fee: PayableFee): number {
  return Math.max(0, fee.amount - fee.amountPaid);
}

/** Total still owed across a set of fees. */
export function outstanding(fees: PayableFee[]): number {
  return fees.reduce((sum, f) => sum + dueOn(f), 0);
}

/** Oldest first, so a payment always clears the longest-standing debt. */
function oldestFirst(fees: PayableFee[]): PayableFee[] {
  return [...fees].sort((a, b) => (a.period || a.dueDate).localeCompare(b.period || b.dueDate));
}

/**
 * Spread `amount` across `fees`, oldest first, allowing partial payment.
 *
 * Over-payment is clamped to what is actually owed: a parent handing over more
 * than the balance must not create a negative due or a fee marked as paid twice
 * over. A zero or negative amount changes nothing.
 */
export function allocatePayment(fees: PayableFee[], amount: number): AllocationResult {
  const totalDue = outstanding(fees);
  let left = Math.min(Math.max(0, Math.floor(amount)), totalDue);
  const collected = left;
  const allocations: Allocation[] = [];

  for (const fee of oldestFirst(fees)) {
    if (left <= 0) break;
    const due = dueOn(fee);
    if (due <= 0) continue;
    const part = Math.min(due, left);
    const amountPaid = fee.amountPaid + part;
    allocations.push({
      id: fee.id,
      amountPaid,
      status: amountPaid >= fee.amount ? "paid" : "partial",
    });
    left -= part;
  }

  return { allocations, collected };
}

/**
 * Undo a collection of `amount`, newest-paid first — the mirror of
 * allocatePayment, so reversing a payment restores exactly the fees it cleared.
 * Never takes back more than was actually paid.
 */
export function reverseAllocation(fees: PayableFee[], amount: number): AllocationResult {
  let left = Math.max(0, Math.floor(amount));
  const allocations: Allocation[] = [];

  const newestPaidFirst = [...fees]
    .filter((f) => f.amountPaid > 0)
    .sort((a, b) => (b.period || b.dueDate).localeCompare(a.period || a.dueDate));

  let reversed = 0;
  for (const fee of newestPaidFirst) {
    if (left <= 0) break;
    const take = Math.min(fee.amountPaid, left);
    const amountPaid = fee.amountPaid - take;
    allocations.push({
      id: fee.id,
      amountPaid,
      status: amountPaid <= 0 ? "pending" : "partial",
    });
    left -= take;
    reversed += take;
  }

  return { allocations, collected: reversed };
}

/**
 * Net profit for a period. Trivial arithmetic, but it is the number an owner
 * makes decisions on, so it gets one definition rather than being re-typed in
 * every screen that shows it.
 */
export function netProfit(income: number, spend: number): number {
  return income - spend;
}

/** Share of everything billed that has been collected, 0-100. Null when nothing is billed. */
export function collectionRate(billed: number, collected: number): number | null {
  if (billed <= 0) return null;
  return Math.round((collected / billed) * 100);
}

/**
 * Share of the student base still active, 0-100. Null when there is no base.
 *
 * Deliberately measured across active + dropped rather than a joining cohort:
 * the old six-month version divided by zero for any centre whose students all
 * enrolled earlier, and displayed 0% to centres that had lost nobody.
 */
export function retentionRate(active: number, dropped: number): number | null {
  const base = active + dropped;
  if (base <= 0) return null;
  return Math.round((active / base) * 100);
}
