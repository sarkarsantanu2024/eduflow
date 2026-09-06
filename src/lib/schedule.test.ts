import { describe, it, expect } from "vitest";
import { splitTimeRange, splitDays, joinTimeRange, to12Hour } from "./schedule";

/**
 * Batch timings were free text before the clock picker, so every owner typed a
 * different shape. These have to be read back into the picker without guessing
 * wrong — a batch shown at the wrong hour is worse than a blank field.
 */

describe("splitTimeRange — reading an existing timing back into two clocks", () => {
  it("reads the compact form owners actually typed", () => {
    expect(splitTimeRange("4p.m. - 6p.m.")).toEqual({ from: "16:00", to: "18:00" });
  });

  it("reads the spelt-out form with minutes", () => {
    expect(splitTimeRange("5:00 PM - 6:30 PM")).toEqual({ from: "17:00", to: "18:30" });
  });

  it("reads a 24-hour range", () => {
    expect(splitTimeRange("16:00-18:00")).toEqual({ from: "16:00", to: "18:00" });
  });

  it("handles noon and midnight without flipping them", () => {
    expect(splitTimeRange("12:00 AM - 12:00 PM")).toEqual({ from: "00:00", to: "12:00" });
  });

  it("reads a morning batch", () => {
    expect(splitTimeRange("7:30 AM - 9:00 AM")).toEqual({ from: "07:30", to: "09:00" });
  });

  it("returns blanks rather than a wrong guess", () => {
    expect(splitTimeRange("evening batch")).toEqual({ from: "", to: "" });
    expect(splitTimeRange("")).toEqual({ from: "", to: "" });
    expect(splitTimeRange(undefined)).toEqual({ from: "", to: "" });
  });
});

describe("joinTimeRange and to12Hour", () => {
  it("formats what the picker stores", () => {
    expect(joinTimeRange("16:00", "18:00")).toBe("4:00 PM – 6:00 PM");
  });

  it("keeps a half-filled range usable", () => {
    expect(joinTimeRange("16:00", "")).toBe("4:00 PM");
    expect(joinTimeRange("", "")).toBe("");
  });

  it("shows 12 rather than 0 at noon and midnight", () => {
    expect(to12Hour("00:00")).toBe("12:00 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
  });

  it("survives a round trip", () => {
    const { from, to } = splitTimeRange("5:00 PM - 6:30 PM");
    expect(joinTimeRange(from, to)).toBe("5:00 PM – 6:30 PM");
  });
});

describe("splitDays — reading typed days into chips", () => {
  it("matches a full day name", () => {
    expect(splitDays("Saturday")).toEqual(["Sat"]);
  });

  it("matches a short list", () => {
    expect(splitDays("Mon, Wed, Fri")).toEqual(["Mon", "Wed", "Fri"]);
  });

  it("accepts other separators owners use", () => {
    expect(splitDays("Tue/Thu")).toEqual(["Tue", "Thu"]);
    expect(splitDays("Mon & Wed")).toEqual(["Mon", "Wed"]);
  });

  it("always returns days in week order, however they were typed", () => {
    expect(splitDays("Sun, Mon")).toEqual(["Mon", "Sun"]);
  });

  it("ignores anything it cannot recognise", () => {
    expect(splitDays("alternate days")).toEqual([]);
    expect(splitDays("")).toEqual([]);
    expect(splitDays(undefined)).toEqual([]);
  });
});
