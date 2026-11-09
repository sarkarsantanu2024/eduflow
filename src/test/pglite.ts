/**
 * A real Postgres for integration tests: PGlite (Postgres compiled to WASM,
 * in memory) with every drizzle/*.sql migration applied in order, split by the
 * same function the production runner uses.
 *
 * Unit tests cannot catch a query that Postgres itself rejects. Two production
 * bugs were exactly that: an ON CONFLICT that could not match its partial
 * index (42P10) and a transaction the driver refuses. Tests built on this run
 * the real SQL and fail the way production would.
 *
 * Never touches the network or any configured DATABASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
// Plain .mjs, shared with scripts/migrate.mjs.
import { statements } from "../../scripts/sql-statements.mjs";

const MIGRATIONS = path.resolve(__dirname, "../../drizzle");

export async function migratedDb() {
  const client = new PGlite();
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    for (const stmt of statements(fs.readFileSync(path.join(MIGRATIONS, file), "utf8")) as string[]) {
      try {
        await client.query(stmt);
      } catch (e) {
        throw new Error(`migration ${file} failed: ${(e as Error).message}\n${stmt.slice(0, 200)}`);
      }
    }
  }
  return { client, db: drizzle(client, { schema, casing: "snake_case" }) };
}
