import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ModuleKey } from "./sectors";

/**
 * Gating decides which modules a paying centre can open. Two failure modes,
 * and only one of them is survivable:
 *
 *  - Fail-open (show a module they have not paid for) costs a little revenue.
 *  - Fail-closed (hide a module they HAVE paid for) is a support call from an
 *    owner locked out of their own certificates mid-term.
 *
 * So every uncertain case here must fail OPEN, and the whole mechanism must
 * stay inert while the billing flag is off.
 *
 * FEATURES reads the env var once at module load, so each case re-imports.
 */

async function planAllows(billing: boolean, plan: string | undefined, module: ModuleKey) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_FEATURE_BILLING", billing ? "true" : "false");
  const { planAllowsModule } = await import("./plan-gating");
  return planAllowsModule(plan, module);
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("with billing switched off — today's live behaviour", () => {
  it("unlocks every module for every plan, including no plan at all", async () => {
    const modules: ModuleKey[] = [
      "attendance", "certificates", "idCards", "tests", "examBoards",
      "promotions", "materials", "performance", "events",
    ];
    for (const m of modules) {
      expect(await planAllows(false, "free", m), m).toBe(true);
      expect(await planAllows(false, undefined, m), m).toBe(true);
    }
  });
});

describe("with billing switched on", () => {
  it("gives the Free tier the core a centre cannot run a day without", async () => {
    expect(await planAllows(true, "free", "attendance")).toBe(true);
  });

  it("holds back what the Starter card actually sells", async () => {
    expect(await planAllows(true, "free", "idCards")).toBe(false);
    expect(await planAllows(true, "free", "certificates")).toBe(false);
    expect(await planAllows(true, "starter", "idCards")).toBe(true);
    expect(await planAllows(true, "starter", "certificates")).toBe(true);
  });

  it("holds the exam block back to Growth, as published", async () => {
    for (const m of ["tests", "examBoards", "promotions", "materials", "performance", "events"] as ModuleKey[]) {
      expect(await planAllows(true, "starter", m), m).toBe(false);
      expect(await planAllows(true, "growth", m), m).toBe(true);
    }
  });

  it("lets a higher tier keep everything a lower one had", async () => {
    const modules: ModuleKey[] = [
      "attendance", "certificates", "idCards", "tests", "examBoards",
      "promotions", "materials", "performance", "events",
    ];
    for (const m of modules) {
      expect(await planAllows(true, "business", m), `business/${m}`).toBe(true);
      expect(await planAllows(true, "enterprise", m), `enterprise/${m}`).toBe(true);
    }
  });

  it("keeps legacy plan codes on everything they already had", async () => {
    // Centres still on the retired 6-tier lineup must not lose a feature the
    // day gating is switched on.
    for (const code of ["pro", "premium", "professional"]) {
      expect(await planAllows(true, code, "tests"), code).toBe(true);
      expect(await planAllows(true, code, "certificates"), code).toBe(true);
    }
  });

  it("fails OPEN on an unrecognised plan code rather than locking a payer out", async () => {
    expect(await planAllows(true, "some-custom-deal", "tests")).toBe(true);
    expect(await planAllows(true, "", "tests")).toBe(true);
    expect(await planAllows(true, undefined, "tests")).toBe(true);
  });
});
