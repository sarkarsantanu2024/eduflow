"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations, institutes, users, students, payments, fees, courses, templates,
  subscriptions, subscriptionPlans,
} from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { getSector } from "@/lib/sectors";
import { ACTING_COOKIE, ACTING_COOKIE_OPTIONS } from "@/lib/tenant";

export type BranchRow = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  onboarded: boolean;
  plan: string;
  planStatus: string;
  planPrice: number; // monthly subscription price (rupees)
  students: number;
  activeStudents: number;
  revenue: number; // collected (successful payments)
  pending: number; // outstanding dues
};

export type OrgOverview = {
  org: {
    id: string;
    name: string;
    partnerSharePercent: number;
  };
  branches: BranchRow[];
  totals: {
    branches: number;
    students: number;
    revenue: number;
    pending: number;
    subscriptionMonthly: number; // sum of all branches' plan prices
    partnerShareMonthly: number; // the org owner's commission on that
  };
};

/** Head-Office roll-up for the signed-in franchise owner (org_admin only). */
export async function getOrgOverview(): Promise<OrgOverview> {
  const profile = await requireOrgAdmin();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, profile.organization_id))
    .limit(1);
  if (!org) redirect("/dashboard");

  const branchRows = await db
    .select()
    .from(institutes)
    .where(eq(institutes.organizationId, org.id));

  const orgInfo = { id: org.id, name: org.name, partnerSharePercent: org.partnerSharePercent };

  if (branchRows.length === 0) {
    return {
      org: orgInfo,
      branches: [],
      totals: { branches: 0, students: 0, revenue: 0, pending: 0, subscriptionMonthly: 0, partnerShareMonthly: 0 },
    };
  }

  const ids = branchRows.map((b) => b.id);

  const [studentCounts, activeCounts, revenueRows, pendingRows, subs] = await Promise.all([
    db.select({ id: students.instituteId, n: count() }).from(students).where(inArray(students.instituteId, ids)).groupBy(students.instituteId),
    db.select({ id: students.instituteId, n: count() }).from(students).where(and(inArray(students.instituteId, ids), eq(students.status, "active"))).groupBy(students.instituteId),
    db.select({ id: payments.instituteId, total: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(inArray(payments.instituteId, ids), eq(payments.status, "success"))).groupBy(payments.instituteId),
    db.select({ id: fees.instituteId, total: sql<number>`coalesce(sum(${fees.amount} - ${fees.amountPaid}), 0)` }).from(fees).where(and(inArray(fees.instituteId, ids), inArray(fees.status, ["pending", "overdue", "partial"]))).groupBy(fees.instituteId),
    db.select({ id: subscriptions.instituteId, plan: subscriptionPlans.name, price: subscriptionPlans.priceMonthly, status: subscriptions.status }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id)).where(inArray(subscriptions.instituteId, ids)),
  ]);

  const num = (rs: { id: string; n?: number; total?: number }[], id: string, key: "n" | "total") =>
    Number(rs.find((r) => r.id === id)?.[key] ?? 0);

  const branches: BranchRow[] = branchRows.map((b) => {
    const sub = subs.find((s) => s.id === b.id);
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      isActive: b.isActive,
      onboarded: b.onboarded,
      plan: sub?.plan ?? "—",
      planStatus: sub?.status ?? "—",
      planPrice: Number(sub?.price ?? 0),
      students: num(studentCounts, b.id, "n"),
      activeStudents: num(activeCounts, b.id, "n"),
      revenue: num(revenueRows, b.id, "total"),
      pending: num(pendingRows, b.id, "total"),
    };
  });

  const totals = branches.reduce(
    (a, b) => ({
      branches: a.branches + 1,
      students: a.students + b.students,
      revenue: a.revenue + b.revenue,
      pending: a.pending + b.pending,
      subscriptionMonthly: a.subscriptionMonthly + b.planPrice,
    }),
    { branches: 0, students: 0, revenue: 0, pending: 0, subscriptionMonthly: 0 },
  );

  const partnerShareMonthly = Math.round((totals.subscriptionMonthly * org.partnerSharePercent) / 100);

  return { org: orgInfo, branches, totals: { ...totals, partnerShareMonthly } };
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/**
 * The franchise owner creates a new branch under their own organization.
 * Mirrors self-signup: seeds sector courses + templates and a trial plan, so
 * the branch works out of the box. A branch-manager login is optional — if
 * omitted, the org owner runs the branch via "Open" from the Head Office.
 */
export async function createBranch(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const profile = await requireOrgAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "abacus");
  const city = String(formData.get("city") ?? "").trim();
  if (name.length < 2) return { error: "Enter a branch name" };

  // Optional branch-manager login.
  const mgrFullName = String(formData.get("managerFullName") ?? "").trim();
  const mgrUsername = String(formData.get("managerUsername") ?? "").trim().toLowerCase();
  const mgrEmail = String(formData.get("managerEmail") ?? "").trim().toLowerCase();
  const mgrPassword = String(formData.get("managerPassword") ?? "");
  const wantsLogin = Boolean(mgrUsername || mgrPassword);
  if (wantsLogin) {
    if (mgrUsername.length < 3) return { error: "Manager username must be at least 3 characters" };
    if (mgrEmail && !mgrEmail.includes("@")) return { error: "Enter a valid manager email (or leave it blank)" };
    if (mgrPassword.length < 8) return { error: "Manager password must be at least 8 characters" };
    const [uTaken, eTaken] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.username, mgrUsername) }),
      mgrEmail ? db.query.users.findFirst({ where: eq(users.email, mgrEmail) }) : Promise.resolve(undefined),
    ]);
    if (uTaken) return { error: "That manager username is already taken" };
    if (mgrEmail && eTaken) return { error: "A user with that manager email already exists" };
  }

  const sector = getSector(type);
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

  const [branch] = await db.insert(institutes).values({
    organizationId: profile.organization_id,
    name, slug, type: sector.value as typeof institutes.$inferInsert["type"],
    ownerName: mgrFullName, city: city || null, onboarded: true, isActive: true,
  }).returning({ id: institutes.id });
  if (!branch) return { error: "Could not create the branch" };

  // Trial Starter subscription (so it shows a plan + counts in roll-ups).
  const starter = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.code, "starter") });
  if (starter) {
    const end = new Date();
    end.setDate(end.getDate() + 14);
    await db.insert(subscriptions).values({ instituteId: branch.id, planId: starter.id, status: "trialing", currentPeriodEnd: end, trialEndsAt: end });
  }

  // Seed sector courses + WhatsApp templates (same as a fresh signup).
  if (sector.seedCourses.length) {
    await db.insert(courses).values(sector.seedCourses.map((c) => ({ instituteId: branch.id, name: c.name, description: c.description })));
  }
  if (sector.seedTemplates.length) {
    await db.insert(templates).values(sector.seedTemplates.map((t) => ({ instituteId: branch.id, name: t.name, type: t.type, channel: "whatsapp", body: t.body })));
  }

  // Optional branch-manager login (institute_admin scoped to this branch).
  // Email is optional; synthesize a unique placeholder when blank.
  if (wantsLogin) {
    await db.insert(users).values({
      instituteId: branch.id, role: "institute_admin",
      username: mgrUsername, email: mgrEmail || `${mgrUsername}@noemail.eduflow.local`, fullName: mgrFullName,
      passwordHash: await hashPassword(mgrPassword),
    });
  }

  revalidatePath("/org");
  return { ok: true };
}

/** Enter one of the org's own branches to manage it (scoped impersonation). */
export async function openBranch(formData: FormData) {
  const profile = await requireOrgAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  if (!instituteId) return;

  // Verify the branch actually belongs to this franchise owner's organization.
  const [branch] = await db
    .select({ id: institutes.id })
    .from(institutes)
    .where(and(eq(institutes.id, instituteId), eq(institutes.organizationId, profile.organization_id)))
    .limit(1);
  if (!branch) throw new Error("That branch is not part of your organization.");

  const store = await cookies();
  store.set(ACTING_COOKIE, instituteId, ACTING_COOKIE_OPTIONS);
  redirect("/dashboard");
}
