/**
 * Plan-tier gating — which optional modules each subscription tier unlocks.
 *
 * SAFE BY DEFAULT: gating only applies when the billing feature flag is on
 * (NEXT_PUBLIC_FEATURE_BILLING=true). While off, `planAllowsModule` returns
 * true for everything, so nothing changes for existing centers.
 *
 * Aligned with the published tier sheet:
 *   - attendance, promotions, materials, certificates, events → all tiers
 *   - tests / rank lists            → Growth and above
 *   - exam boards, performance      → Professional
 * Unknown / unmapped plan codes are treated as unlimited (fail-open), so a
 * mis-set plan never hides a paying customer's features.
 */
import type { ModuleKey } from "@/lib/sectors";
import { FEATURES } from "@/lib/features";

/** Rank of the 6 tiers we ship in-app (matches subscription_plans.code). */
const PLAN_RANK: Record<string, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  business: 4,
  premium: 5,
  enterprise: 6,
  professional: 3, // legacy alias for older records still on "professional"
};

/** Minimum tier rank required to use each optional module. */
const MODULE_MIN_RANK: Partial<Record<ModuleKey, number>> = {
  tests: 2, // Growth+
  examBoards: 3, // Pro+
  performance: 3, // Pro+
  // attendance, promotions, materials, certificates, events default to 1 (all tiers)
};

/** True if a center on `planCode` may use `module`. Fail-open when gating is off. */
export function planAllowsModule(planCode: string | undefined, module: ModuleKey): boolean {
  if (!FEATURES.billing) return true; // gating disabled → everything unlocked
  const planRank = PLAN_RANK[planCode ?? ""] ?? Number.POSITIVE_INFINITY; // unknown → unlimited
  const needed = MODULE_MIN_RANK[module] ?? 1;
  return planRank >= needed;
}
