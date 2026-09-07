import type { TestScore } from "@/lib/store/local-db";

/**
 * Rank-list arithmetic for Tests & Rank Lists.
 *
 * Pulled out of the view so the number a parent reads on a WhatsApp result
 * card ("Rank 3 in the batch") can be tested. Two rules the inline version got
 * wrong, both of them visible to a parent:
 *
 *  1. TIES SHARE A RANK. Two students on the same marks are joint-first, not
 *     #1 and #2. The old code ranked by array position, so which of the two
 *     got told they came second depended purely on data-entry order.
 *  2. COMPARE ON PERCENTAGE, NOT RAW MARKS. The "Out of" field is per-row and
 *     defaults to 100, so one test really can hold 45/50 and 80/100. 90% must
 *     beat 80%; raw marks said the opposite.
 *
 * Ranks use standard competition numbering (1, 2, 2, 4) — after a two-way tie
 * for second, the next student is fourth. That is what a rank list means
 * everywhere else a parent has seen one.
 */

export interface RankedScore extends TestScore {
  /** 1-based, shared across ties. */
  rank: number;
  /** score / maxScore as 0–100, rounded to one decimal. */
  percent: number;
}

/** Percentage for one row. A missing or zero "out of" scores 0 rather than Infinity. */
export function scorePercent(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 1000) / 10;
}

/** The distinct test names present, in first-seen order (drives the filter chips). */
export function testNames(scores: TestScore[]): string[] {
  return Array.from(new Set(scores.map((s) => s.testName)));
}

/**
 * The rank list for one test: highest percentage first, ties sharing a rank and
 * ordered by name so the table does not reshuffle between renders.
 */
export function rankScores(scores: TestScore[], testName: string): RankedScore[] {
  const rows = scores
    .filter((s) => s.testName === testName)
    .map((s) => ({ ...s, percent: scorePercent(s.score, s.maxScore) }))
    .sort((a, b) => b.percent - a.percent || a.studentName.localeCompare(b.studentName));

  let rank = 0;
  let lastPercent = Number.NaN;
  return rows.map((row, i) => {
    // A new percentage takes the position it actually sits at (1-based), which
    // is what makes the sequence skip after a tie.
    if (row.percent !== lastPercent) {
      rank = i + 1;
      lastPercent = row.percent;
    }
    return { ...row, rank };
  });
}
