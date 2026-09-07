import { describe, it, expect } from "vitest";
import { nextCertSerial, highestSequence } from "./serial";

/**
 * A serial is the key /verify/<serial> looks a certificate up by, printed on
 * paper a parent keeps for years. Two certificates on one serial means one of
 * them verifies as somebody else's achievement.
 */

const certs = (...serials: string[]) => serials.map((serial) => ({ serial }));

describe("highestSequence", () => {
  it("finds the highest number issued that year", () => {
    expect(highestSequence(certs("EF-2026-0001", "EF-2026-0007", "EF-2026-0003"), 2026)).toBe(7);
  });

  it("counts only the year asked for", () => {
    expect(highestSequence(certs("EF-2025-0042", "EF-2026-0002"), 2026)).toBe(2);
  });

  it("starts from zero for a year with nothing issued", () => {
    expect(highestSequence(certs("EF-2025-0042"), 2026)).toBe(0);
    expect(highestSequence([], 2026)).toBe(0);
  });

  it("ignores serials that are not ours rather than crashing on them", () => {
    expect(highestSequence(certs("", "ABC-2026-1", "EF-2026-x", "EF-2026-0005"), 2026)).toBe(5);
  });
});

describe("nextCertSerial", () => {
  it("issues the first certificate of a year as 0001", () => {
    expect(nextCertSerial([], 2026)).toBe("EF-2026-0001");
  });

  it("continues from the last one issued", () => {
    expect(nextCertSerial(certs("EF-2026-0001", "EF-2026-0002"), 2026)).toBe("EF-2026-0003");
  });

  it("does not reuse a serial after an earlier certificate is deleted", () => {
    // Three issued, the middle one deleted — a count-based serial would hand
    // out EF-2026-0003 a second time, onto paper already in a parent's hands.
    const afterDeletion = certs("EF-2026-0001", "EF-2026-0003");
    expect(nextCertSerial(afterDeletion, 2026)).toBe("EF-2026-0004");
  });

  it("restarts numbering in a new year without colliding with the old one", () => {
    const lastYear = certs("EF-2026-0001", "EF-2026-0002");
    expect(nextCertSerial(lastYear, 2027)).toBe("EF-2027-0001");
  });

  it("stamps the year it is actually issued in, not a hard-coded one", () => {
    const year = new Date().getFullYear();
    expect(nextCertSerial([])).toBe(`EF-${year}-0001`);
  });

  it("keeps four-digit padding past a hundred and widens past ten thousand", () => {
    expect(nextCertSerial(certs("EF-2026-0099"), 2026)).toBe("EF-2026-0100");
    expect(nextCertSerial(certs("EF-2026-9999"), 2026)).toBe("EF-2026-10000");
  });

  it("never repeats a serial across a run of issues", () => {
    const issued: { serial: string }[] = [];
    for (let i = 0; i < 25; i++) issued.push({ serial: nextCertSerial(issued, 2026) });
    expect(new Set(issued.map((c) => c.serial)).size).toBe(25);
  });
});
