import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, storagePath, renderTemplate } from "./utils";

/**
 * `formatCurrency` takes PAISE while every `amount` column in the database
 * stores WHOLE RUPEES — which is why 42 call sites multiply by 100 on the way
 * in. That mismatch is the single easiest way to render a 100× wrong figure to
 * an owner, so it is pinned here: if anyone ever "cleans up" the units, these
 * fail loudly instead of quietly showing ₹5 for a ₹500 fee.
 */

describe("formatCurrency — paise in, rupees on screen", () => {
  it("divides by a hundred — 50,000 paise is ₹500, not ₹50,000", () => {
    expect(formatCurrency(50_000)).toBe("₹500");
  });

  it("is what a caller holding rupees gets after the ×100 every call site does", () => {
    const feeInRupees = 500;
    expect(formatCurrency(feeInRupees * 100)).toBe("₹500");
  });

  it("groups in the Indian system — lakhs, not thousands", () => {
    expect(formatCurrency(10_00_000 * 100)).toBe("₹10,00,000");
  });

  it("shows no paise, because no centre bills in them", () => {
    expect(formatCurrency(50_050)).toBe("₹501"); // 500.50 → nearest rupee
  });

  it("renders zero as an amount rather than a blank", () => {
    expect(formatCurrency(0)).toBe("₹0");
  });

  it("renders a refund or credit as negative", () => {
    expect(formatCurrency(-500 * 100)).toBe("-₹500");
  });
});

describe("formatDate", () => {
  it("renders an ISO date the way an Indian centre reads it — day first", () => {
    // The month abbreviation itself is the platform's (Node says "Sept", some
    // browsers "Sep"), so pin the order and the zero-padded day, not the ICU
    // spelling — a locked spelling would fail on a runtime upgrade.
    expect(formatDate("2026-09-07")).toMatch(/^07 Sept? 2026$/);
    expect(formatDate("2026-01-15")).toBe("15 Jan 2026");
  });

  it("accepts a Date object", () => {
    expect(formatDate(new Date("2026-01-15T00:00:00"))).toBe("15 Jan 2026");
  });

  it("shows a dash rather than 'Invalid Date' when nothing is on file", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("storagePath", () => {
  it("keeps every file under its own centre's prefix", () => {
    expect(storagePath("inst-1", "students", "photo.jpg")).toBe("inst-1/students/photo.jpg");
  });
});

describe("renderTemplate", () => {
  it("fills placeholders and leaves unknown ones intact", () => {
    expect(renderTemplate("Hi {{name}} {{missing}}", { name: "Rohit" })).toBe("Hi Rohit {{missing}}");
  });
});
