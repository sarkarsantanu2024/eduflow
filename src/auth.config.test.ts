import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

/**
 * The middleware gate. /api/cron used to be missing from the public paths, so
 * Vercel Cron (which has no session) was redirected to /login and daily billing
 * never ran. The cron route authenticates itself with CRON_SECRET.
 */
type AuthorizedArgs = Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0];
const authorized = (path: string, user?: { role: string }) =>
  authConfig.callbacks.authorized({
    auth: user ? { user, expires: "" } : null,
    request: { nextUrl: new URL(`https://app.test${path}`) },
  } as unknown as AuthorizedArgs);

describe("middleware gate", () => {
  it("lets Vercel Cron reach the cron route without a session", () => {
    expect(authorized("/api/cron/automation")).toBe(true);
  });

  it("still requires a session for the app", () => {
    for (const path of ["/dashboard", "/fees", "/students", "/api/anything"]) expect(authorized(path)).toBe(false);
  });

  it("keeps the public pages public", () => {
    for (const path of ["/", "/login", "/register", "/verify/abc", "/privacy.html", "/api/leads"]) {
      expect(authorized(path)).toBe(true);
    }
  });

  it("does not open look-alike paths", () => {
    expect(authorized("/api/cronjob")).toBe(false);
  });

  it("sends non-admins away from the super-admin console", () => {
    const res = authorized("/admin", { role: "institute_admin" });
    expect(res).toBeInstanceOf(Response);
    expect(authorized("/admin", { role: "super_admin" })).toBe(true);
  });
});
