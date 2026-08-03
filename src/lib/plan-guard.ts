import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { getActiveInstituteId } from "@/lib/tenant";
import { planAllowsModule } from "@/lib/plan-gating";
import { FEATURES } from "@/lib/features";
import { DEMO_INSTITUTE_IDS } from "@/lib/demo-tenant";
import type { ModuleKey } from "@/lib/sectors";

/**
 * Server-side plan gate for a page. Complements the sidebar link hiding by
 * blocking direct URL access too. No-op unless billing gating is on
 * (NEXT_PUBLIC_FEATURE_BILLING); then a center whose plan doesn't include the
 * module is redirected to the Billing page to upgrade.
 */
export async function requireModule(module: ModuleKey): Promise<void> {
  if (!FEATURES.billing) return; // gating disabled → allow everything

  const activeId = await getActiveInstituteId();
  if (!activeId) return; // no active center (auth/onboarding guards handle this)
  if (DEMO_INSTITUTE_IDS.includes(activeId)) return; // demos show every feature

  const [sub] = await db
    .select({ code: subscriptionPlans.code })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.instituteId, activeId))
    .limit(1);

  if (!planAllowsModule(sub?.code, module)) redirect("/billing");
}
