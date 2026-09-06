import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit tests for the calculations a centre's money depends on.
 *
 * Deliberately node-only and dependency-free: every module under test is pure,
 * so the suite runs in about a second and can gate every deploy. Anything that
 * needs a database or a browser is out of scope here — that belongs in an
 * end-to-end pass against a staging centre.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: "verbose",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
