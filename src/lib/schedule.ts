/**
 * Batch schedule parsing and formatting.
 *
 * Extracted from the form dialog so it can be tested without rendering a
 * component. Batch timings created before the clock picker existed are free
 * text in every imaginable shape, so the parser is deliberately forgiving and
 * falls back to blank rather than guessing wrong.
 */

/** Short weekday labels, in the order a timetable is read. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "16:00" → "4:00 PM". Empty in, empty out. */
export function to12Hour(hhmm: string): string {
  // Empty in, empty out — and it has to be checked explicitly, because
  // Number("") is 0, not NaN. Without this an unset end time formatted as
  // "12:00 AM", so a batch with only a start saved as "4:00 PM – 12:00 AM"
  // and appeared to run until midnight.
  if (!hhmm || !hhmm.trim()) return "";
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || h < 0 || h > 23) return "";
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(Number.isFinite(m) ? m : 0).padStart(2, "0")} ${suffix}`;
}

/** Two clock values → the single string stored on the batch. */
export function joinTimeRange(from: string, to: string): string {
  const a = to12Hour(from);
  const b = to12Hour(to);
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

/**
 * Read an existing timing back into two 24-hour values for the clock inputs.
 * Batches created before this control hold free text in every imaginable
 * shape ("4p.m. - 6p.m.", "5:00 PM - 6:30 PM", "16:00-18:00"), so parse
 * loosely and fall back to blank rather than showing something wrong.
 */
export function splitTimeRange(value?: string): { from: string; to: string } {
  const found: string[] = [];
  if (value) {
    const twelve = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/gi;
    let m: RegExpExecArray | null;
    while (found.length < 2 && (m = twelve.exec(value)) !== null) {
      const base = Number(m[1] ?? 0) % 12;
      const hour = (m[3] ?? "").toLowerCase() === "p" ? base + 12 : base;
      found.push(`${String(hour).padStart(2, "0")}:${m[2] ?? "00"}`);
    }
    if (found.length === 0) {
      const twentyFour = /(\d{1,2}):(\d{2})/g;
      let n: RegExpExecArray | null;
      while (found.length < 2 && (n = twentyFour.exec(value)) !== null) {
        found.push(`${(n[1] ?? "0").padStart(2, "0")}:${n[2] ?? "00"}`);
      }
    }
  }
  return { from: found[0] ?? "", to: found[1] ?? "" };
}

/** "Saturday, Mon" → ["Mon","Sat"]. Matches on the first three letters. */
export function splitDays(value?: string): string[] {
  if (!value) return [];
  const parts = value.split(/[,/|+&]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return WEEKDAYS.filter((d) => parts.some((p) => p.startsWith(d.toLowerCase())));
}

