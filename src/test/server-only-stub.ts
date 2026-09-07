/**
 * `server-only` is a Next.js build-time marker with no npm package behind it,
 * so importing a server module under vitest fails to resolve. vitest.config.ts
 * aliases it here — an empty module — which lets the suite import the pure
 * exports of server files (capacity maths, automation date arithmetic) without
 * pulling in a database.
 *
 * This weakens nothing in the app: the real guard is Next's own bundler, which
 * still refuses to ship a "server-only" module to the browser.
 */
export {};
