import { describe, it, expect } from "vitest";
import {
  allocatePayment, reverseAllocation, outstanding, dueOn,
  netProfit, collectionRate, retentionRate, type PayableFee,
} from "./money";

/** A monthly fee for `period`, optionally part-paid. */
const fee = (id: string, period: string, amount: number, amountPaid = 0): PayableFee => ({
  id, period, dueDate: `${period}-05`, amount, amountPaid,
});

describe("allocatePayment — which fee does a parent's money clear?", () => {
  it("clears a single fee exactly", () => {
    const { allocations, collected } = allocatePayment([fee("a", "2026-09", 500)], 500);
    expect(collected).toBe(500);
    expect(allocations).toEqual([{ id: "a", amountPaid: 500, status: "paid" }]);
  });

  it("pays the OLDEST month first, not the newest", () => {
    const fees = [fee("sep", "2026-09", 500), fee("jul", "2026-07", 500), fee("aug", "2026-08", 500)];
    const { allocations } = allocatePayment(fees, 500);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]!.id).toBe("jul");
  });

  it("spills across months, marking the last one partial", () => {
    const fees = [fee("jul", "2026-07", 500), fee("aug", "2026-08", 500)];
    const { allocations, collected } = allocatePayment(fees, 800);
    expect(collected).toBe(800);
    expect(allocations).toEqual([
      { id: "jul", amountPaid: 500, status: "paid" },
      { id: "aug", amountPaid: 300, status: "partial" },
    ]);
  });

  it("tops up a fee that was already part-paid", () => {
    const { allocations } = allocatePayment([fee("a", "2026-09", 500, 200)], 300);
    expect(allocations).toEqual([{ id: "a", amountPaid: 500, status: "paid" }]);
  });

  it("NEVER takes more than is owed, even if handed more", () => {
    const { allocations, collected } = allocatePayment([fee("a", "2026-09", 500)], 900);
    expect(collected).toBe(500);
    expect(allocations[0]!.amountPaid).toBe(500);
  });

  it("skips fees that are already settled", () => {
    const fees = [fee("paid", "2026-07", 500, 500), fee("open", "2026-08", 500)];
    const { allocations } = allocatePayment(fees, 500);
    expect(allocations.map((a) => a.id)).toEqual(["open"]);
  });

  it("does nothing for zero, negative or fractional-down amounts", () => {
    const fees = [fee("a", "2026-09", 500)];
    expect(allocatePayment(fees, 0).collected).toBe(0);
    expect(allocatePayment(fees, -100).collected).toBe(0);
    expect(allocatePayment(fees, 0.4).collected).toBe(0);
    expect(allocatePayment(fees, 0).allocations).toEqual([]);
  });

  it("does nothing when everything is already paid", () => {
    const { allocations, collected } = allocatePayment([fee("a", "2026-09", 500, 500)], 500);
    expect(collected).toBe(0);
    expect(allocations).toEqual([]);
  });

  it("orders one-off fees with no period by due date", () => {
    const older = { id: "old", period: "", dueDate: "2026-03-01", amount: 100, amountPaid: 0 };
    const newer = { id: "new", period: "", dueDate: "2026-08-01", amount: 100, amountPaid: 0 };
    const { allocations } = allocatePayment([newer, older], 100);
    expect(allocations[0]!.id).toBe("old");
  });
});

describe("reverseAllocation — undoing a collection", () => {
  it("restores a fully paid fee to pending", () => {
    const { allocations, collected } = reverseAllocation([fee("a", "2026-09", 500, 500)], 500);
    expect(collected).toBe(500);
    expect(allocations).toEqual([{ id: "a", amountPaid: 0, status: "pending" }]);
  });

  it("rolls back newest-first, mirroring the oldest-first collection", () => {
    const fees = [fee("jul", "2026-07", 500, 500), fee("aug", "2026-08", 500, 300)];
    const { allocations } = reverseAllocation(fees, 300);
    expect(allocations).toEqual([{ id: "aug", amountPaid: 0, status: "pending" }]);
  });

  it("leaves a partial balance when only some is reversed", () => {
    const { allocations } = reverseAllocation([fee("a", "2026-09", 500, 500)], 200);
    expect(allocations).toEqual([{ id: "a", amountPaid: 300, status: "partial" }]);
  });

  it("never reverses more than was actually paid", () => {
    const { collected } = reverseAllocation([fee("a", "2026-09", 500, 200)], 999);
    expect(collected).toBe(200);
  });

  it("round-trips: pay then reverse returns every fee to where it started", () => {
    const start = [fee("jul", "2026-07", 500), fee("aug", "2026-08", 500)];
    const paid = allocatePayment(start, 800);
    const afterPay = start.map((f) => {
      const a = paid.allocations.find((x) => x.id === f.id);
      return a ? { ...f, amountPaid: a.amountPaid } : f;
    });
    expect(outstanding(afterPay)).toBe(200);

    const back = reverseAllocation(afterPay, paid.collected);
    const afterReverse = afterPay.map((f) => {
      const a = back.allocations.find((x) => x.id === f.id);
      return a ? { ...f, amountPaid: a.amountPaid } : f;
    });
    expect(outstanding(afterReverse)).toBe(1000);
    expect(afterReverse.every((f) => f.amountPaid === 0)).toBe(true);
  });
});

describe("outstanding and dueOn", () => {
  it("sums what is still owed", () => {
    expect(outstanding([fee("a", "2026-08", 500, 200), fee("b", "2026-09", 500)])).toBe(800);
  });

  it("never reports a negative balance on an overpaid row", () => {
    expect(dueOn(fee("a", "2026-09", 500, 700))).toBe(0);
    expect(outstanding([fee("a", "2026-09", 500, 700)])).toBe(0);
  });

  it("is zero for no fees", () => {
    expect(outstanding([])).toBe(0);
  });
});

describe("netProfit", () => {
  it("matches the worked example: 25,000 income less 14,500 expenses", () => {
    const expenses = 7000 + 1500 + 5000 + 1000; // rent, electricity, salary, other
    expect(expenses).toBe(14500);
    expect(netProfit(25000, expenses)).toBe(10500);
  });

  it("goes negative when a centre spends more than it collects", () => {
    expect(netProfit(4000, 6500)).toBe(-2500);
  });

  it("is zero when nothing has happened", () => {
    expect(netProfit(0, 0)).toBe(0);
  });
});

describe("collectionRate", () => {
  it("reports the share of billed money that came in", () => {
    expect(collectionRate(10000, 2500)).toBe(25);
  });

  it("is null — not 0% — when nothing has been billed", () => {
    expect(collectionRate(0, 0)).toBeNull();
  });

  it("reaches 100 when everything is collected", () => {
    expect(collectionRate(7500, 7500)).toBe(100);
  });
});

describe("retentionRate", () => {
  it("is 100% for a centre that has lost nobody, however old its students are", () => {
    // The bug this replaces: a six-month joining cohort divided by zero here
    // and displayed 0% to established centres.
    expect(retentionRate(8, 0)).toBe(100);
  });

  it("falls as students drop out", () => {
    expect(retentionRate(9, 1)).toBe(90);
  });

  it("is null — not 0% — for a centre with no students at all", () => {
    expect(retentionRate(0, 0)).toBeNull();
  });
});
