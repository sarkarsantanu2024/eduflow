import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Neon (serverless Postgres) + Drizzle ORM.
 *
 * Uses the HTTP driver — ideal for Vercel serverless / edge: one round-trip
 * per query, no connection pool to manage. (Multi-statement transactions are
 * not supported over HTTP; do those with explicit per-row guards instead.)
 *
 * The whole app talks to the database through this `db` export. To move to
 * Supabase (or any Postgres) later, only DATABASE_URL changes.
 */
// Fall back to a syntactically-valid placeholder when DATABASE_URL is absent,
// so `next build` (which imports this module) never crashes on missing env.
// The Neon HTTP driver is lazy — it only connects on the first query, by which
// point the real DATABASE_URL is present at runtime. A missing var only fails
// an actual query, with a clear message, not the build.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("[db] DATABASE_URL is not set — database queries will fail until it is configured.");
}

const sql = neon(connectionString || "postgresql://placeholder:placeholder@localhost/placeholder");

export const db = drizzle(sql, { schema, casing: "snake_case" });

export { schema };
