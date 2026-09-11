import { describe, it, expect, vi } from "vitest";
import { SUBSCRIPTION_PLANS, SEAT_PACKS, customPlanName } from "@/lib/constants";

// plan-limits imports the Neon client at module load for its two async
// lookups. The maths under test never touches it.
vi.mock("@/lib/db", () => ({ db: {}, schema: {} }));

const { capacityMessage, getCapacityOffer, seatRequestMessage, centerRef } = await import("./plan-limits");
type Usage = Parameters<typeof getCapacityOffer>[0];

/**
 * Student capacity is prepaid and enforced server-side, so this is the code
 * that stands between an owner and their next admission. The rule the product
 * promises — nothing already in the account is affected, only the NEXT
 * admission waits — has to be visible in the words as well as the numbers.
 */

const usage = (over: Partial<Usage> = {}): Usage => ({
  used: 95, planCap: 100, extra: 0, cap: 100, remaining: 5, ratio: 0.95,
  atCap: false, nearCap: true, planName: "Starter", planCode: "starter",
  billingCycle: "monthly", isCustom: false, customPrice: null,
  ...over,
});

describe("capacityMessage — what an owner is told at the limit", () => {
  it("names the plan, the cap and the count for a single admission", () => {
    const msg = capacityMessage(usage({ used: 100, remaining: 0, atCap: true }), 1);
    expect(msg).toContain("Starter");
    expect(msg).toContain("100");
  });

  it("promises that existing data is untouched — the whole point of the policy", () => {
    expect(capacityMessage(usage({ used: 100, remaining: 0, atCap: true }), 1)).toMatch(/completely safe/i);
    expect(capacityMessage(usage({ remaining: 5 }), 20)).toMatch(/nothing already in your account is affected/i);
  });

  it("tells a bulk importer how many seats are actually left", () => {
    const msg = capacityMessage(usage({ used: 95, remaining: 5 }), 20);
    expect(msg).toContain("20 students");
    expect(msg).toContain("5 seats");
  });

  it("says 'seat' not 'seats' when exactly one is left", () => {
    expect(capacityMessage(usage({ used: 99, remaining: 1 }), 5)).toContain("only 1 seat remain");
  });
});

describe("getCapacityOffer — sell a pack, or be honest and say upgrade", () => {
  it("offers every seat pack to a centre that has just outgrown its plan", () => {
    const offer = getCapacityOffer(usage({ used: 100, cap: 100, remaining: 0, atCap: true }));
    expect(offer.packs.map((p) => p.seats)).toEqual(SEAT_PACKS.map((p) => p.seats));
  });

  it("steers a centre to the next plan once packs cost more than the upgrade", () => {
    // Deep into seat packs on Starter: another pack is worse value than Growth.
    const offer = getCapacityOffer(usage({ used: 340, planCap: 100, extra: 250, cap: 350 }));
    expect(offer.packs.every((p) => p.upgradeIsBetter)).toBe(true);
    expect(offer.recommendedPlan).not.toBeNull();
    expect(offer.reason).toMatch(/costs less than buying more seats/i);
  });

  it("recommends a plan that genuinely holds more students than they have now", () => {
    const offer = getCapacityOffer(usage({ used: 340, planCap: 100, extra: 250, cap: 350 }));
    const plan = SUBSCRIPTION_PLANS.find((p) => p.code === offer.recommendedPlan!.code)!;
    expect(plan.maxStudents === null || plan.maxStudents > 350).toBe(true);
  });

  it("names the recommended plan in words an owner can act on", () => {
    const offer = getCapacityOffer(usage({ used: 340, planCap: 100, extra: 250, cap: 350 }));
    expect(offer.recommendedPlan!.name).toBeTruthy();
    expect(offer.recommendedPlan!.students).toBeTruthy();
    expect(offer.reason).toContain(offer.recommendedPlan!.name);
  });

  it("flags a pack that would overshoot the next plan's own ceiling", () => {
    // Buying 100 seats onto Free (20) lands past Starter's 100 — pointless.
    const offer = getCapacityOffer(usage({ used: 20, planCap: 20, extra: 0, cap: 20, planName: "Free", planCode: "free" }));
    expect(offer.packs.find((p) => p.seats === 100)!.upgradeIsBetter).toBe(true);
  });

  it("still offers packs, with no upgrade to push, on an unlimited plan", () => {
    const offer = getCapacityOffer(usage({
      planCode: "enterprise", planName: "Enterprise", planCap: null, cap: null,
      used: 5000, remaining: Number.POSITIVE_INFINITY, ratio: 0, nearCap: false,
    }));
    expect(offer.recommendedPlan).toBeNull();
    expect(offer.reason).toBe("");
    expect(offer.packs.length).toBe(SEAT_PACKS.length);
  });

  it("does not push an upgrade at an unknown plan code", () => {
    const offer = getCapacityOffer(usage({ planCode: "mystery" }));
    expect(offer.recommendedPlan).toBeNull();
  });

  it("never steers a custom center onto a published plan — theirs was agreed for them", () => {
    // 2,000 students at a negotiated price, sitting on Starter for its modules.
    const offer = getCapacityOffer(usage({
      isCustom: true, customPrice: 2500, planCode: "starter",
      planCap: 2000, cap: 2000, used: 1990, remaining: 10,
    }));
    expect(offer.recommendedPlan).toBeNull();
    expect(offer.reason).toBe("");
    expect(offer.packs.every((p) => !p.upgradeIsBetter)).toBe(true);
  });
});

describe("customPlanName — one name for a negotiated plan, everywhere it shows", () => {
  it("names the plan after the center, its amount and its student count", () => {
    expect(customPlanName("MMA Springfield", 2500, 2000)).toBe("MMA Springfield - ₹2,500 - 2,000 students");
  });

  it("still reads as a plan when the center has no name on file", () => {
    expect(customPlanName("", 999, 150)).toBe("Custom - ₹999 - 150 students");
  });
});

describe("seatRequestMessage — the WhatsApp we have to quote from", () => {
  const msg = seatRequestMessage({
    instituteName: "Bright Minds Abacus",
    centerId: "EDU-A1B2C3",
    usage: usage({ used: 98, cap: 100 }),
    seats: 50,
  });

  it("carries everything needed to quote without a back-and-forth", () => {
    expect(msg).toContain("Bright Minds Abacus");
    expect(msg).toContain("EDU-A1B2C3");
    expect(msg).toContain("Starter");
    expect(msg).toContain("100 Students");
    expect(msg).toContain("98");
    expect(msg).toContain("50 additional student seats");
  });

  it("never quotes a price — packs are priced by us on WhatsApp, not in-app", () => {
    for (const p of SEAT_PACKS) expect(msg).not.toContain(String(p.price));
  });

  it("says Unlimited rather than 'null Students'", () => {
    const m = seatRequestMessage({
      instituteName: "X", centerId: "EDU-1", seats: 25,
      usage: usage({ cap: null, planCap: null, planName: "Enterprise" }),
    });
    expect(m).toContain("Unlimited");
    expect(m).not.toContain("null");
  });

  it("shows a dash rather than a blank line for an unnamed centre", () => {
    const m = seatRequestMessage({ instituteName: "", centerId: "EDU-1", seats: 25, usage: usage() });
    expect(m).toContain("Institute: —");
  });
});

describe("centerRef — the short code an owner reads out", () => {
  it("builds a stable, uppercase, dash-free reference", () => {
    expect(centerRef("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("EDU-A1B2C3");
  });

  it("is deterministic — the same centre always quotes the same code", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(centerRef(id)).toBe(centerRef(id));
  });

  it("does not throw on a short or empty id", () => {
    expect(centerRef("")).toBe("EDU-");
    expect(centerRef("ab")).toBe("EDU-AB");
  });
});
