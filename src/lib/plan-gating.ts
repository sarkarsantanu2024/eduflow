/**
 * Plan-tier gating — which optional modules each subscription tier unlocks.
 *
 * SAFE BY DEFAULT: gating only applies when the billing feature flag is on
 * (NEXT_PUBLIC_FEATURE_BILLING=true). While off, `planAllowsModule` returns
 * true for everything, so nothing changes for existing centers.
 *
 * PRICING RULE: size (students, staff logins) is the headline axis, and the
 * published lineup layers modules on top of it:
 *   Free     — the core a center cannot run a day without: students, fees,
 *              UPI-QR, WhatsApp reminders, attendance.
 *   Starter  — adds the things a small center hands to a parent: ID cards and
 *              QR-verified certificates.
 *   Growth   — adds the exam / money / staff block: tests, rank lists, exam
 *              boards, promotions, materials, competitions and events.
 *   Business — adds branding, analytics and multi-activity (not modules).
 *
 * Keep this in step with SUBSCRIPTION_PLANS in src/lib/constants.ts and the
 * per-plan `features` map in src/lib/db/seed.ts.
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
  certificates: 1, // Starter+ — listed on the Starter card alongside ID cards
  tests: 2, // Growth+ — the published "exams, tests & rank lists" block
  examBoards: 2, // Growth+
  promotions: 2, // Growth+ — "student promotion"
  materials: 2, // Growth+ — "inventory"
  performance: 2, // Growth+ — competitions sit with the exam block
  events: 2, // Growth+
};

/** True if a center on `planCode` may use `module`. Fail-open when gating is off. */
export function planAllowsModule(planCode: string | undefined, module: ModuleKey): boolean {
  if (!FEATURES.billing) return true; // gating disabled → everything unlocked
  const planRank = PLAN_RANK[planCode ?? ""] ?? Number.POSITIVE_INFINITY; // unknown → unlimited
  const needed = MODULE_MIN_RANK[module] ?? 1;
  return planRank >= needed;
}
