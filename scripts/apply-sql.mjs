/**
 * Apply a plain .sql migration file to DATABASE_URL, statement by statement.
 * The Neon HTTP driver runs one statement per call, so the file is split on
 * semicolons at end-of-line.
 *
 *   node --env-file=.env.local scripts/apply-sql.mjs drizzle/0004_leads.sql
 *
 * Every migration in drizzle/ is written to be additive and idempotent
 * (CREATE TABLE IF NOT EXISTS / ADD VALUE IF NOT EXISTS), so re-running is safe.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env.local scripts/apply-sql.mjs <file.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (use --env-file=.env.local)");
  process.exit(1);
}

const sql = neon(url);

// Strip comment-only lines, then split into statements.
const statements = readFileSync(file, "utf8")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n")
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${file} — ${statements.length} statement(s)`);
for (const [i, statement] of statements.entries()) {
  const preview = statement.replace(/\s+/g, " ").slice(0, 70);
  try {
    await sql.query(statement);
    console.log(`  [${i + 1}/${statements.length}] ok   ${preview}…`);
  } catch (e) {
    console.error(`  [${i + 1}/${statements.length}] FAIL ${preview}…`);
    console.error(`        ${e.message}`);
    process.exit(1);
  }
}
console.log("Done.");
