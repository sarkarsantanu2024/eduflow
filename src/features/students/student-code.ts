/**
 * Student ID generation.
 *
 * Owners used to type these by hand, which produced collisions, inconsistent
 * shapes, and IDs containing the letter O where a zero was meant
 * ("MMA-Barasat-OO5"). The ID is now built from things the record already
 * knows, so it is consistent across a centre and readable at a glance.
 *
 *   MMA-Dumdum-001
 *   │   │      └─ running serial for that centre and branch
 *   │   └──────── branch / city from the centre profile (omitted if unset)
 *   └──────────── initials of the centre name
 *
 * The serial is a running total, not per-month, so it never repeats and the
 * number doubles as "how many admissions this branch has taken".
 */

/**
 * Short code for the centre.
 *
 * "Maa Manasa Abacus" → "MMA"  (initials)
 * "Radha Art Centre"  → "RAC"  (initials)
 * "MMA Dumdum"        → "MMA"  (the brand is ALREADY an acronym — keep it)
 *
 * That last case is why this is not just "first letter of each word": a centre
 * named "MMA Dumdum" would come out as "MD", chopping the brand down to a
 * single letter and producing "MD-Dumdum-001" where the owner expects
 * "MMA-Dumdum-001".
 */
export function centrePrefix(businessName: string): string {
  const words = (businessName || "").trim().split(/\s+/).filter(Boolean);

  // A first word that is already all-caps is the brand itself ("MMA Dumdum",
  // "S.K. Coaching"). Skipped when EVERY word is capitalised, because that is
  // an owner typing the whole name in caps ("MAA MANASA ABACUS"), where the
  // initials are still what you want.
  const shouty = words.length > 1 && words.every((w) => w === w.toUpperCase());
  const first = (words[0] ?? "").replace(/[^A-Za-z]/g, "");
  if (!shouty && first.length >= 2 && /^[A-Z]+$/.test(first)) {
    return first.slice(0, 4);
  }

  const initials = words
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

/** Everything before the serial, e.g. "MMA-Dumdum-". */
export function codeStem(businessName: string, city: string): string {
  const branch = branchPart(city);
  return [centrePrefix(businessName), branch].filter(Boolean).join("-") + "-";
}

/**
 * Next free ID for this centre and branch.
 * `taken` is every code already in use, so the result never collides even if
 * an owner previously typed something by hand in the same shape.
 */
export function nextStudentCode(
  businessName: string,
  city: string,
  taken: Iterable<string>,
): string {
  const stem = codeStem(businessName, city);
  const used = new Set(Array.from(taken, (c) => c.trim().toUpperCase()));

  let highest = 0;
  for (const code of used) {
    if (!code.startsWith(stem.toUpperCase())) continue;
    const tail = code.slice(stem.length);
    // Only a pure number continues the series. This skips IDs from the earlier
    // dated format ("MMA-Dumdum-2609-004"), where a plain parseInt would read
    // 2609 and hand the next admission "MMA-Dumdum-2610". Those IDs stay valid
    // on the cards already printed; they just don't drive the counter.
    if (!/^\d+$/.test(tail)) continue;
    const n = Number.parseInt(tail, 10);
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
