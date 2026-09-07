import type { Certificate } from "@/lib/store/local-db";

/**
 * Certificate serial numbers.
 *
 * The serial is not decoration — it is the key the public /verify/<serial>
 * page looks a certificate up by, and it is printed on paper a parent keeps
 * and an employer may check years later. Two certificates sharing a serial
 * means one of them verifies as somebody else.
 *
 * The inline version was `EF-2026-` + (count + 1), which broke twice:
 *  - Delete any earlier certificate and the count falls back onto a serial
 *    already issued and already printed.
 *  - The year was a literal, so every certificate issued in 2027 still says
 *    2026.
 *
 * Numbering continues from the highest serial ever issued in that year, so a
 * deletion leaves a gap rather than a collision.
 */

const SERIAL_RE = /^EF-(\d{4})-(\d+)$/;

/** Highest sequence number already issued for `year`, or 0 if none. */
export function highestSequence(existing: Pick<Certificate, "serial">[], year: number): number {
  let max = 0;
  for (const c of existing) {
    const m = SERIAL_RE.exec((c.serial ?? "").trim());
    if (!m || Number(m[1]) !== year) continue;
    const n = Number(m[2]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** The next unused serial for `year` (defaults to the current year). */
export function nextCertSerial(
  existing: Pick<Certificate, "serial">[],
  year: number = new Date().getFullYear(),
): string {
  const seq = highestSequence(existing, year) + 1;
  return `EF-${year}-${String(seq).padStart(4, "0")}`;
}
