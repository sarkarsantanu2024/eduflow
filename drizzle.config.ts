import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit doesn't read .env.local by default — load it explicitly.
config({ path: ".env.local" });

/**
 * Drizzle Kit config — generates & pushes migrations to Neon.
 *   npx drizzle-kit push      # sync schema to the DB (dev)
 *   npx drizzle-kit generate  # emit SQL migration files
 *   npx drizzle-kit studio    # browse the DB
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
