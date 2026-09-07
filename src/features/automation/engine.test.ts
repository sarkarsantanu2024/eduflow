import { describe, it, expect, vi } from "vitest";
import { DEFAULT_AUTOMATION } from "@/lib/store/types";

// The engine opens a Neon client at module load. The date and settings maths
// tested here never issues a query.
vi.mock("@/lib/db", () => ({ db: {}, schema: {} }));

const { addDays, normalizeSettings, istToday } = await import("./engine");

/**
 * The daily automation pass decides which fees are "due in 3 days" and which
 * are overdue. Both are pure date arithmetic, and both are the kind of thing
 * that silently drifts by a day across a month boundary or a DST-shaped bug —
 * which a centre experiences as a reminder that went out a day late, or an
 * overdue notice sent to a parent who paid on time.
 */

describe("addDays — the reminder window", () => {
  it("moves forward within a month", () => {
    expect(addDays("2026-09-07", 3)).toBe("2026-09-10");
  });

  it("moves backward, which is how the overdue floor is built", () => {
    expect(addDays("2026-09-07", -30)).toBe("2026-08-08");
  });

  it("returns the same day for zero", () => {
    expect(addDays("2026-09-07", 0)).toBe("2026-09-07");
  });

  it("crosses a month end", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a year end in both directions", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("knows a leap year from a common one", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("stays on the same calendar day regardless of the machine's timezone", () => {
    // The whole reason this works on UTC internally: a centre in IST and a
    // Vercel box in UTC must agree on which day a fee falls due.
    expect(addDays("2026-09-07", 1)).toBe("2026-09-08");
    expect(addDays("2026-09-07", 365)).toBe("2027-09-07");
  });
});

describe("normalizeSettings — a centre that has never opened the automation panel", () => {
  it("returns the defaults for null or undefined", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_AUTOMATION);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_AUTOMATION);
  });

  it("defaults every rule to OFF — automation is opt-in", () => {
    const s = normalizeSettings(null);
    expect(s.feeDue).toBe(false);
    expect(s.feeOverdue).toBe(false);
    expect(s.absent).toBe(false);
    expect(s.birthday).toBe(false);
  });

  it("keeps what the owner switched on", () => {
    expect(normalizeSettings({ ...DEFAULT_AUTOMATION, feeDue: true, feeDueDays: 5 })).toMatchObject({
      feeDue: true, feeDueDays: 5,
    });
  });

  it("fills in a key a stored record predates, instead of leaving it undefined", () => {
    // Settings are stored as JSON, so a row written before a rule existed is
    // missing that key entirely. It must read as off, not as undefined.
    const legacy = { feeDue: true } as unknown as Parameters<typeof normalizeSettings>[0];
    const s = normalizeSettings(legacy);
    expect(s.feeDue).toBe(true);
    expect(s.birthday).toBe(false);
    expect(s.feeDueDays).toBe(DEFAULT_AUTOMATION.feeDueDays);
  });

  it("does not mutate the defaults, so one centre cannot leak into the next", () => {
    normalizeSettings({ ...DEFAULT_AUTOMATION, feeDue: true, birthday: true });
    expect(DEFAULT_AUTOMATION.feeDue).toBe(false);
    expect(DEFAULT_AUTOMATION.birthday).toBe(false);
  });
});

describe("istToday — re-exported so client and server cannot drift", () => {
  it("reports the Indian date, not the UTC one, late at night", () => {
    // 19:00 UTC on the 7th is already past midnight on the 8th in IST. Taking
    // the date in UTC is what made the two disagree for five and a half hours
    // every night.
    expect(istToday(new Date("2026-09-07T19:00:00Z"))).toMatchObject({
      ymd: "2026-09-08", mmdd: "09-08", year: 2026,
    });
  });

  it("agrees with UTC during the Indian working day", () => {
    expect(istToday(new Date("2026-09-07T06:00:00Z")).ymd).toBe("2026-09-07");
  });
});
