import { describe, it, expect } from "vitest";
import { collectableFees, effectiveFee } from "./types";

/**
 * collectableFees exists because soft-deleting a student left their fee rows
 * behind: the store filtered the student out but not the fees pointing at
 * them, so a trashed student's dues stayed in "Pending Fees" with no way to
 * reach the money. One real centre read Rs 13,500 against Rs 8,500 owed.
 */
describe("collectableFees — money the centre can actually chase", () => {
  const students = [{ id: "s1" }, { id: "s2" }];
  const fees = [
    { id: "f1", studentId: "s1" },
    { id: "f2", studentId: "gone" }, // student moved to Trash
    { id: "f3", studentId: "" },     // raised against nobody
  ];

  it("keeps fees for students who are still there", () => {
    expect(collectableFees(fees, students).map((f) => f.id)).toContain("f1");
  });

  it("drops fees whose student has been trashed", () => {
    expect(collectableFees(fees, students).map((f) => f.id)).not.toContain("f2");
  });

  it("KEEPS a fee with no student attached", () => {
    // It is a real charge somebody raised; hiding money is worse than showing
    // an unassigned line.
    expect(collectableFees(fees, students).map((f) => f.id)).toContain("f3");
  });

  it("drops everything when no students remain", () => {
    expect(collectableFees([{ id: "f1", studentId: "s1" }], []).map((f) => f.id)).toEqual([]);
  });

  it("is empty for no fees", () => {
    expect(collectableFees([], students)).toEqual([]);
  });
});

describe("effectiveFee — per-student override, else the centre's fee", () => {
  it("uses the student's own fee when set", () => {
    expect(effectiveFee({ monthlyFee: 800 }, 500)).toBe(800);
  });

  it("falls back to the centre fee when unset or zero", () => {
    expect(effectiveFee({ monthlyFee: 0 }, 500)).toBe(500);
    expect(effectiveFee({}, 500)).toBe(500);
  });

  it("ignores a negative override rather than crediting the parent", () => {
    expect(effectiveFee({ monthlyFee: -100 }, 500)).toBe(500);
  });
});
