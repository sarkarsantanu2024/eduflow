import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { getActiveInstituteId, isImpersonating } from "@/lib/tenant";
import { db } from "@/lib/db";
import { institutes, subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { AppShell } from "@/components/layout/app-shell";
import type { UserRole } from "@/types/database.types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const impersonating = await isImpersonating();

  // A super-admin who isn't managing a center belongs in the platform console.
  if (profile.role === "super_admin" && !impersonating) redirect("/admin");
  // A franchise owner who isn't managing a branch belongs in the Head-Office console.
  if (profile.role === "org_admin" && !impersonating) redirect("/org");

  const activeId = await getActiveInstituteId();
  let instituteName: string | undefined;
  let planLabel = "EduFlow";
  let planCode: string | undefined;
  let needsOnboarding = false;

  if (activeId) {
    // These two are independent — run them in one round-trip, not two.
    const [institute, sub] = await Promise.all([
      db.query.institutes.findFirst({
        where: eq(institutes.id, activeId),
        columns: { name: true, onboarded: true, isActive: true },
      }),
      db
        .select({ planName: subscriptionPlans.name, planCode: subscriptionPlans.code })
        .from(subscriptions)
        .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.instituteId, activeId))
        .limit(1),
    ]);

    instituteName = institute?.name;

    // Suspended/blocked center: lock out the owner & staff (super-admin
    // impersonating is exempt so they can still help / collect dues).
    if (institute && institute.isActive === false && !impersonating) {
      redirect("/suspended");
    }

    needsOnboarding = profile.role === "institute_admin" && institute?.onboarded === false;
    if (sub[0]) {
      planLabel = `${sub[0].planName} plan`;
      planCode = sub[0].planCode;
    }
  }

  // When a super-admin opens a center, show the center's (institute_admin) menus.
  const effectiveRole: UserRole = impersonating ? "institute_admin" : profile.role;

  return (
    <AppShell
      profile={profile}
      effectiveRole={effectiveRole}
      instituteName={instituteName}
      activeInstituteId={activeId ?? null}
      planLabel={planLabel}
      planCode={planCode}
      needsOnboarding={needsOnboarding}
      impersonating={impersonating}
    >
      {children}
    </AppShell>
  );
}
