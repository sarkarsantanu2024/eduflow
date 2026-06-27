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

  const activeId = await getActiveInstituteId();
  let instituteName: string | undefined;
  let planLabel = "EduFlow";
  let needsOnboarding = false;

  if (activeId) {
    const institute = await db.query.institutes.findFirst({
      where: eq(institutes.id, activeId),
      columns: { name: true, onboarded: true, isActive: true },
    });
    instituteName = institute?.name;

    // Suspended/blocked center: lock out the owner & staff (super-admin
    // impersonating is exempt so they can still help / collect dues).
    if (institute && institute.isActive === false && !impersonating) {
      redirect("/suspended");
    }

    needsOnboarding = profile.role === "institute_admin" && institute?.onboarded === false;

    const sub = await db
      .select({ planName: subscriptionPlans.name })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.instituteId, activeId))
      .limit(1);
    if (sub[0]) planLabel = `${sub[0].planName} plan`;
  }

  // When a super-admin opens a center, show the center's (institute_admin) menus.
  const effectiveRole: UserRole = impersonating ? "institute_admin" : profile.role;

  return (
    <AppShell
      profile={profile}
      effectiveRole={effectiveRole}
      instituteName={instituteName}
      planLabel={planLabel}
      needsOnboarding={needsOnboarding}
      impersonating={impersonating}
    >
      {children}
    </AppShell>
  );
}
