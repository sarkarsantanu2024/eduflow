import { describe, it, expect } from "vitest";
import { rankScores, scorePercent, testNames } from "./rank";
import type { TestScore } from "@/lib/store/types";

/**
 * The rank on a result card is the second-most-argued-about number in a centre
 * after the fee. A parent shown "Rank 2" when their child tied for first will
 * ring the owner, and the owner has no way to explain it.
 */

const score = (over: Partial<TestScore> & { studentName: string; score: number }): TestScore => ({
  id: `ts-${over.studentName}-${over.score}`,
  testName: "June Unit Test",
  date: "2026-06-10",
  batchId: "b1",
  studentId: `st-${over.studentName}`,
  parentMobile: "9800000000",
  maxScore: 100,
  ...over,
});

describe("scorePercent", () => {
  it("scores out of the paper's own total", () => {
    expect(scorePercent(45, 50)).toBe(90);
    expect(scorePercent(80, 100)).toBe(80);
  });

  it("keeps one decimal rather than rounding two students onto the same mark", () => {
    expect(scorePercent(2, 3)).toBe(66.7);
  });

  it("refuses to divide by a missing total", () => {
    expect(scorePercent(40, 0)).toBe(0);
    expect(scorePercent(40, Number.NaN)).toBe(0);
  });

  it("handles a full and a zero paper", () => {
    expect(scorePercent(0, 100)).toBe(0);
    expect(scorePercent(100, 100)).toBe(100);
  });
});

describe("rankScores — the list a parent is quoted from", () => {
  it("puts the highest scorer first", () => {
    const ranked = rankScores(
      [score({ studentName: "Bina", score: 70 }), score({ studentName: "Aarav", score: 95 })],
      "June Unit Test",
    );
    expect(ranked.map((r) => [r.studentName, r.rank])).toEqual([
      ["Aarav", 1],
      ["Bina", 2],
    ]);
  });

  it("makes tied students joint-first, not first and second", () => {
    const ranked = rankScores(
      [
        score({ studentName: "Aarav", score: 88 }),
        score({ studentName: "Bina", score: 88 }),
        score({ studentName: "Chetan", score: 70 }),
      ],
      "June Unit Test",
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("skips the rank a tie consumed, the way every rank list does", () => {
    const ranked = rankScores(
      [
        score({ studentName: "Aarav", score: 95 }),
        score({ studentName: "Bina", score: 88 }),
        score({ studentName: "Chetan", score: 88 }),
        score({ studentName: "Divya", score: 60 }),
      ],
      "June Unit Test",
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("compares percentages, so a 45/50 paper beats an 80/100 one", () => {
    const ranked = rankScores(
      [
        score({ studentName: "Bina", score: 80, maxScore: 100 }),
        score({ studentName: "Aarav", score: 45, maxScore: 50 }),
      ],
      "June Unit Test",
    );
    expect(ranked[0]!.studentName).toBe("Aarav");
    expect(ranked[0]!.percent).toBe(90);
    expect(ranked[0]!.rank).toBe(1);
  });

  it("orders a tie by name so the table does not reshuffle between visits", () => {
    const entered = [
      score({ studentName: "Zoya", score: 88 }),
      score({ studentName: "Aarav", score: 88 }),
    ];
    expect(rankScores(entered, "June Unit Test").map((r) => r.studentName)).toEqual(["Aarav", "Zoya"]);
    expect(rankScores([...entered].reverse(), "June Unit Test").map((r) => r.studentName)).toEqual([
      "Aarav",
      "Zoya",
    ]);
  });

  it("never mixes two tests into one rank list", () => {
    const ranked = rankScores(
      [
        score({ studentName: "Aarav", score: 40, testName: "June Unit Test" }),
        score({ studentName: "Bina", score: 99, testName: "July Unit Test" }),
      ],
      "June Unit Test",
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.rank).toBe(1);
  });

  it("leaves the caller with nothing rather than a phantom rank when the test is unknown", () => {
    expect(rankScores([score({ studentName: "Aarav", score: 90 })], "")).toEqual([]);
    expect(rankScores([], "June Unit Test")).toEqual([]);
  });

  it("ranks a whole-batch zero as a legitimate joint-first", () => {
    const ranked = rankScores(
      [score({ studentName: "Aarav", score: 0 }), score({ studentName: "Bina", score: 0 })],
      "June Unit Test",
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });
});

describe("testNames — the filter chips", () => {
  it("lists each test once, in the order it was first recorded", () => {
    expect(
      testNames([
        score({ studentName: "A", score: 1, testName: "June" }),
        score({ studentName: "B", score: 1, testName: "July" }),
        score({ studentName: "C", score: 1, testName: "June" }),
      ]),
    ).toEqual(["June", "July"]);
  });

  it("is empty before any score is recorded", () => {
    expect(testNames([])).toEqual([]);
  });
});
