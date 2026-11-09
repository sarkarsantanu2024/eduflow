/**
 * Split a .sql file into single statements.
 *
 * Shared by scripts/migrate.mjs (production migrations) and the integration
 * tests (src/test/pglite.ts), so the tests apply the migrations exactly the way
 * a deploy does.
 *
 * Handles both dialects in drizzle/:
 *  - drizzle-kit output, which puts several statements on one line separated by
 *    an inline `--> statement-breakpoint` marker;
 *  - hand-written SQL, one statement per line ending in `;`, sometimes wrapping
 *    a `DO $$ ... $$` block that must NOT be split on its inner semicolons.
 *
 * The driver rejects multiple commands in one call, so the split has to be exact.
 */
export function statements(text) {
  // drizzle's marker is a reliable separator — turn it into a plain terminator.
  const normalized = text.replace(/-->\s*statement-breakpoint/g, "\n");

  const out = [];
  let buf = "";
  let dollar = false;
  for (const raw of normalized.split(/\r?\n/)) {
    const line = raw.replace(/^\s*--.*$/, "");        // strip whole-line comments
    if (!line.trim() && !buf.trim()) continue;

    const marks = (line.match(/\$\$/g) || []).length;
    if (marks % 2 === 1) dollar = !dollar;
    buf += line + "\n";

    if (!dollar && /;\s*$/.test(line.trimEnd())) {
      const s = buf.trim().replace(/;$/, "").trim();
      if (s) out.push(s);
      buf = "";
    }
  }
  const tail = buf.trim().replace(/;$/, "").trim();
  if (tail) out.push(tail);
  return out;
}
