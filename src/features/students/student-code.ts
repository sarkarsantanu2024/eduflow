/**
 * Student ID generation.
 *
 * Owners used to type these by hand, which produced collisions, inconsistent
 * shapes, and IDs containing the letter O where a zero was meant
 * ("MMA-Barasat-OO5"). The ID is now built from things the record already
 * knows, so it is consistent across a centre and readable at a glance.
 *
 *   MMA-Barasat-2609-005
 *   │   │        │    └─ 3-digit serial within that centre, branch and month
 *   │   │        └────── admission month (YYMM), so the ID says when they joined
 *   │   └─────────────── branch / city from the centre profile (omitted if unset)
 *   └─────────────────── initials of the centre name
 *
 * The serial restarts each month, which is fine: the YYMM segment keeps the
 * whole ID unique, and "the fifth admission of September" is a more useful
 * number to an owner than a running total since the centre opened.
 */

/** Initials of the centre name: "Maa Manasa Abacus" → "MMA". */
export function centrePrefix(businessName: string): string {
  const initials = (businessName || "")
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  return initials || "STU";
}

/** Branch segment from the centre's city: "Barasat" → "Barasat". */
export function branchPart(city: string): string {
  const first = (city || "").trim().split(/\s+/)[0] ?? "";
  return first
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12)
    .replace(/^./, (c) => c.toUpperCase());
}

/** "2026-09-14" → "2609". Falls back to today when the date is not set yet. */
function yearMonth(admissionDate: string): string {
  const d = /^\d{4}-\d{2}/.test(admissionDate) ? admissionDate : new Date().toISOString().slice(0, 10);
  return d.slice(2, 4) + d.slice(5, 7);
}

/** Everything before the serial, e.g. "MMA-Barasat-2609-". */
export function codeStem(businessName: string, city: string, admissionDate: string): string {
  const branch = branchPart(city);
  return [centrePrefix(businessName), branch, yearMonth(admissionDate)].filter(Boolean).join("-") + "-";
}

/**
 * Next free ID for this centre / branch / admission month.
 * `taken` is every code already in use, so the result never collides even if
 * an owner previously typed something by hand in the same shape.
 */
export function nextStudentCode(
  businessName: string,
  city: string,
  admissionDate: string,
  taken: Iterable<string>,
): string {
  const stem = codeStem(businessName, city, admissionDate);
  const used = new Set(Array.from(taken, (c) => c.trim().toUpperCase()));

  let highest = 0;
  for (const code of used) {
    if (!code.startsWith(stem.toUpperCase())) continue;
    const n = Number.parseInt(code.slice(stem.length), 10);
    if (Number.isFinite(n) && n > highest) highest = n;
  }

  let serial = highest + 1;
  let candidate = stem + String(serial).padStart(3, "0");
  while (used.has(candidate.toUpperCase())) {
    serial += 1;
    candidate = stem + String(serial).padStart(3, "0");
  }
  return candidate;
}
