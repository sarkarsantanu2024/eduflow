/**
 * Plan-tier gating — which optional modules each subscription tier unlocks.
 *
 * SAFE BY DEFAULT: gating only applies when the billing feature flag is on
 * (NEXT_PUBLIC_FEATURE_BILLING=true). While off, `planAllowsModule` returns
 * true for everything, so nothing changes for existing centers.
 *
 * PRICING RULE: we charge for SIZE (students, staff logins) and EXTRAS
 * (posters, videos, custom branding, onboarding, multi-center) — never for a
 * center's daily workflow. So every *paid* tier gets every module; the Free
 * tier is limited to the core (students, fees, WhatsApp, attendance) so there
 * is a real reason to move up to Starter.
 *
 * Unknown / unmapped plan codes are treated as unlimited (fail-open), so a
 * mis-set plan never hides a paying customer's features.
 */
import type { ModuleKey } from "@/lib/sectors";
import { FEATURES } from "@/lib/features";

/** Rank of the tiers we ship in-app (matches subscription_plans.code). */
const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  business: 3,
  enterprise: 4,
  // Legacy codes from the old 6-tier lineup — kept so existing records keep
  // every capability they already had. Retired in src/lib/db/seed.ts.
  pro: 3,
  premium: 3,
  professional: 2,
};

/** Minimum tier rank required to use each optional module. */
const MODULE_MIN_RANK: Partial<Record<ModuleKey, number>> = {
  attendance: 0, // Free+ — a center can't run a day without it
  // Everything else defaults to 1 = every PAID tier, from Starter up. A ₹499
  // tuition center gets tests; a ₹499 dance school gets exam boards. Both are
  // daily work, not a premium feature.
};

/** True if a center on `planCode` may use `module`. Fail-open when gating is off. */
export function planAllowsModule(planCode: string | undefined, module: ModuleKey): boolean {
  if (!FEATURES.billing) return true; // gating disabled → everything unlocked
  const planRank = PLAN_RANK[planCode ?? ""] ?? Number.POSITIVE_INFINITY; // unknown → unlimited
  const needed = MODULE_MIN_RANK[module] ?? 1;
  return planRank >= needed;
}
