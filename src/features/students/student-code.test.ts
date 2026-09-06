import { describe, it, expect } from "vitest";
import { centrePrefix, branchPart, codeStem, nextStudentCode } from "./student-code";

/**
 * Student IDs used to be typed by hand, which produced collisions and IDs
 * containing the letter O where a zero was meant ("MMA-Barasat-OO5").
 */

describe("centrePrefix — the short code for a centre", () => {
  it("keeps a brand that is ALREADY an acronym", () => {
    // "MMA Dumdum" once produced "MD", chopping the brand to one letter.
    expect(centrePrefix("MMA Dumdum")).toBe("MMA");
    expect(centrePrefix("MMA Barasat")).toBe("MMA");
  });

  it("takes initials from a name written in words", () => {
    expect(centrePrefix("Maa Manasa Abacus")).toBe("MMA");
    expect(centrePrefix("Radha Art Centre")).toBe("RAC");
  });

  it("still takes initials when the WHOLE name is capitalised", () => {
    // Otherwise an owner shouting their name would get "MAA".
    expect(centrePrefix("MAA MANASA ABACUS")).toBe("MMA");
  });

  it("handles dotted initials and long acronyms", () => {
    expect(centrePrefix("S.K. Coaching")).toBe("SK");
    expect(centrePrefix("NIELIT Centre Barasat")).toBe("NIEL");
    expect(centrePrefix("ABACUS")).toBe("ABAC");
  });

  it("falls back to STU when there is no usable name", () => {
    expect(centrePrefix("")).toBe("STU");
    expect(centrePrefix("   ")).toBe("STU");
    expect(centrePrefix("123 456")).toBe("STU");
  });
});

describe("branchPart", () => {
  it("takes the first word of the city", () => {
    expect(branchPart("Barasat")).toBe("Barasat");
    expect(branchPart("New Town")).toBe("New");
  });

  it("is empty when no city is set", () => {
    expect(branchPart("")).toBe("");
  });
});

describe("codeStem", () => {
  it("omits the branch when the centre has no city", () => {
    expect(codeStem("MMA Dumdum", "")).toBe("MMA-");
    expect(codeStem("MMA Dumdum", "Dumdum")).toBe("MMA-Dumdum-");
  });
});

describe("nextStudentCode", () => {
  it("starts a new centre at 001", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", [])).toBe("MMA-Dumdum-001");
  });

  it("continues the running series", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-001", "MMA-Dumdum-002"]))
      .toBe("MMA-Dumdum-003");
  });

  it("carries on past a gap rather than refilling it", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-001", "MMA-Dumdum-005"]))
      .toBe("MMA-Dumdum-006");
  });

  it("never collides with an existing code, whatever its case", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["mma-dumdum-001"])).toBe("MMA-Dumdum-002");
  });

  it("keeps each branch on its own series", () => {
    expect(nextStudentCode("MMA Dumdum", "Barasat", ["MMA-Dumdum-009"])).toBe("MMA-Barasat-001");
  });

  it("ignores IDs whose tail is not a plain number", () => {
    // The dated format from an earlier build would otherwise be read as 2609
    // and hand the next admission "MMA-Dumdum-2610"; the hand-typed
    // letter-O case would break parsing outright.
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-2609-004"])).toBe("MMA-Dumdum-001");
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-OO5"])).toBe("MMA-Dumdum-001");
  });

  it("counts legacy and current IDs together without tripping over the legacy ones", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-2609-004", "MMA-Dumdum-003"]))
      .toBe("MMA-Dumdum-004");
  });

  it("grows past 999 rather than wrapping", () => {
    expect(nextStudentCode("MMA Dumdum", "Dumdum", ["MMA-Dumdum-999"])).toBe("MMA-Dumdum-1000");
  });
});
