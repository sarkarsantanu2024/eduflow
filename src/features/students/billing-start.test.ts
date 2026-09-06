import { describe, it, expect } from "vitest";
import { defaultBillingStart, billsInMonth, nextMonth } from "./billing-start";

/**
 * The bug these lock down: the admission form assumed "admitted today", so
 * entering a student who had attended since January raised an admission fee
 * dated in January — eight months overdue the moment it was saved — and
 * invoiced them for the current month on the day of entry.
 */
const NOW = "2026-09";

describe("defaultBillingStart — when does a new admission start being billed?", () => {
  it("bills a walk-in from this month", () => {
    expect(defaultBillingStart("2026-09-07", NOW)).toBe("2026-09");
  });

  it("bills from NEXT month when the admission predates this month", () => {
    // Entering a long-standing student: they settled up on paper, so the
    // months before the centre started using EduFlow are not invoiced.
    expect(defaultBillingStart("2026-01-10", NOW)).toBe("2026-10");
    expect(defaultBillingStart("2026-08-31", NOW)).toBe("2026-10");
  });

  it("bills a future admission from its own month, not today", () => {
    expect(defaultBillingStart("2026-11-03", NOW)).toBe("2026-11");
  });

  it("falls back to this month when no admission date is set", () => {
    expect(defaultBillingStart("", NOW)).toBe("2026-09");
  });

  it("handles a year boundary", () => {
    expect(defaultBillingStart("2025-12-31", NOW)).toBe("2026-10");
  });
});

describe("nextMonth", () => {
  it("advances within a year", () => {
    expect(nextMonth("2026-09")).toBe("2026-10");
  });

  it("rolls December into January", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

describe("billsInMonth — does the nightly run invoice this student?", () => {
  const s = (admissionDate: string, billingStartMonth = "") => ({ admissionDate, billingStartMonth });

  it("does not bill before the billing start", () => {
    expect(billsInMonth(s("2026-01-10", "2026-10"), "2026-09")).toBe(false);
  });

  it("bills from the billing start onwards, and every month after", () => {
    expect(billsInMonth(s("2026-01-10", "2026-10"), "2026-10")).toBe(true);
    expect(billsInMonth(s("2026-01-10", "2026-10"), "2027-03")).toBe(true);
  });

  it("falls back to the admission month when no start is set", () => {
    // Every student recorded before this field existed keeps behaving as before.
    expect(billsInMonth(s("2026-01-10"), "2026-09")).toBe(true);
    expect(billsInMonth(s("2026-11-01"), "2026-09")).toBe(false);
  });

  it("bills a student with no dates at all", () => {
    // Silently not invoicing someone is the worse failure of the two.
    expect(billsInMonth(s("", ""), "2026-09")).toBe(true);
  });

  it("treats a blank billing start as unset rather than as a value", () => {
    expect(billsInMonth({ admissionDate: "2026-01-10", billingStartMonth: "   " }, "2026-09")).toBe(true);
  });
});
