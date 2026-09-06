import { describe, it, expect } from "vitest";
import { todayIso, currentPeriod, istToday } from "./date";

/**
 * The bug these lock down: client code built "today" with toISOString(), which
 * is the date in UTC. India is UTC+5:30, so between midnight and 05:30 IST it
 * returned YESTERDAY while the server worked in IST. A payment taken at 1am was
 * filed under the previous day, and on the 1st of a month before 05:30 the
 * "current period" was still last month — so a fee raised then landed in the
 * wrong month's books.
 *
 * Instants below are given in UTC; the IST wall-clock time is in the name.
 */
const at = (utc: string) => new Date(utc);

describe("todayIso — the same 'today' on client and server", () => {
  it("is already tomorrow at 00:30 IST, when UTC is still yesterday", () => {
    expect(todayIso(at("2026-09-06T19:00:00Z"))).toBe("2026-09-07");
  });

  it("holds through the last minute of the UTC-vs-IST gap (05:29 IST)", () => {
    expect(todayIso(at("2026-09-06T23:59:00Z"))).toBe("2026-09-07");
  });

  it("agrees with UTC once past 05:30 IST", () => {
    expect(todayIso(at("2026-09-07T00:30:00Z"))).toBe("2026-09-07");
    expect(todayIso(at("2026-09-07T17:30:00Z"))).toBe("2026-09-07");
  });

  it("rolls the year over at 00:30 IST on 1 January", () => {
    expect(todayIso(at("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });

  it("is the plain UTC date at midday, where the two never disagree", () => {
    expect(todayIso(at("2026-09-07T06:00:00Z"))).toBe("2026-09-07");
  });
});

describe("currentPeriod — which month do fees belong to?", () => {
  it("is the NEW month at 01:00 IST on the 1st", () => {
    // The sharpest case: the old UTC date would still have said 2026-09.
    expect(currentPeriod(at("2026-09-30T19:30:00Z"))).toBe("2026-10");
  });

  it("is still the old month at 23:00 IST on the last day", () => {
    expect(currentPeriod(at("2026-09-30T17:30:00Z"))).toBe("2026-09");
  });
});

describe("istToday parts", () => {
  it("splits the date for birthday matching", () => {
    expect(istToday(at("2026-09-07T06:00:00Z"))).toEqual({
      ymd: "2026-09-07",
      mmdd: "09-07",
      year: 2026,
    });
  });
});
