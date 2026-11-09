import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests for the calculations a centre's money depends on.
 *
 * Node-only. Unit tests are pure and run in about a second. Integration tests
 * (`*.integration.test.ts`) run the real SQL against an in-memory Postgres
 * (PGlite, see src/test/pglite.ts) built from drizzle/*.sql — no network, no
 * DATABASE_URL — so they can gate every deploy too.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: "verbose",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next's "server-only" marker has no package behind it. Stub it so the
      // pure exports of server modules can be imported and tested; the modules
      // that also touch the database mock `@/lib/db` themselves.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
