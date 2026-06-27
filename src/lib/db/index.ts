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
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env.local",
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema, casing: "snake_case" });

export { schema };
