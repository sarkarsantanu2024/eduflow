/**
 * migrate.mjs — apply drizzle/*.sql to the database, in order, exactly once.
 *
 *   npm run db:migrate              # apply everything outstanding
 *   npm run db:migrate -- --dry     # show what would run, change nothing
 *   npm run db:migrate -- 0007      # apply only files matching "0007"
 *
 * WHY THIS EXISTS
 * `drizzle-kit push` diffs schema.ts against the live database and can propose
 * destructive changes; it ignores drizzle/*.sql entirely. Several of our
 * migrations are hand-written SQL (enum ALTERs, guarded constraint adds) that
 * drizzle-kit cannot generate. So the .sql files are the source of truth and
 * this runner is what applies them.
 *
 * Applied files are recorded in the `_migrations` table, so re-running is a
 * no-op. Every migration is additive and idempotent (IF NOT EXISTS / guarded
 * DO blocks), which means an unrecorded-but-already-applied file is harmless.
 *
 * Statements run one at a time rather than in a single transaction: Postgres
 * refuses `ALTER TYPE ... ADD VALUE` inside a transaction block, and we use it.
 */
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

const args = process.argv.slice(2);
const dry = args.includes("--dry") || args.includes("--dry-run");
// --baseline records migrations as applied WITHOUT running them. Use it once on
// a database that predates this runner, so the already-applied history is not
// replayed. 0000/0001 in particular are drizzle-generated CREATE TYPE/TABLE
// statements with no IF NOT EXISTS guards — replaying them would error.
const baseline = args.includes("--baseline");
// --production-only is for the Vercel build hook. Preview and production point
// at the same database today, so if previews migrated, opening a pull request
// would alter the production schema before the code shipped. Anything that is
// not a Vercel production build exits quietly instead.
const productionOnly = args.includes("--production-only");
const filters = args.filter((a) => !a.startsWith("--"));

if (productionOnly && process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] skipped — VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}, production only`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run via `npm run db:migrate` (which loads .env.local).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

/**
 * Split a .sql file into single statements.
 *
 * Handles both dialects in this folder:
 *  - drizzle-kit output, which puts several statements on one line separated by
 *    an inline `--> statement-breakpoint` marker;
 *  - hand-written SQL, one statement per line ending in `;`, sometimes wrapping
 *    a `DO $$ ... $$` block that must NOT be split on its inner semicolons.
 *
 * The driver rejects multiple commands in one call, so the split has to be exact.
 */
function statements(text) {
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

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "tag"        text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )`;

  const done = new Set(
    (await sql`select tag from "_migrations"`).map((r) => r.tag),
  );

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
    .sort();

  const todo = files.filter((f) => !done.has(f));
  if (!todo.length) {
    console.log(`Up to date — ${files.length} migration(s), nothing outstanding.`);
    return;
  }

  console.log(`${todo.length} outstanding migration(s):\n`);
  for (const file of todo) {
    const stmts = statements(fs.readFileSync(path.join(DIR, file), "utf8"));
    const tag = baseline ? "[baseline] " : dry ? "[dry] " : "";
    console.log(`  ${tag}${file}  (${stmts.length} statement${stmts.length === 1 ? "" : "s"})`);
    if (dry) {
      stmts.forEach((s) => console.log(`        ${s.replace(/\s+/g, " ").slice(0, 100)}`));
      continue;
    }
    if (baseline) {
      await sql`insert into "_migrations" (tag) values (${file}) on conflict do nothing`;
      console.log(`        recorded as applied (not executed)`);
      continue;
    }
    for (const s of stmts) {
      try {
        await sql.query(s);
      } catch (err) {
        console.error(`\n  FAILED in ${file}:\n    ${s.replace(/\s+/g, " ").slice(0, 160)}\n    ${err.message}`);
        process.exit(1);
      }
    }
    await sql`insert into "_migrations" (tag) values (${file}) on conflict do nothing`;
    console.log(`        applied`);
  }
  console.log(
    `\n${dry ? "Dry run — nothing was changed."
      : baseline ? "Baselined — history recorded, no SQL executed."
      : "Done."}`,
  );
}

main();
