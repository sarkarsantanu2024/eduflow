"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  institutes, users, students, payments, fees, subscriptions, subscriptionPlans, capacityEvents,
} from "@/lib/db/schema";
import { requireSuperAdmin, getCurrentProfile } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ACTING_COOKIE, ACTING_COOKIE_OPTIONS } from "@/lib/tenant";
import { DEMO_INSTITUTE_IDS } from "@/lib/demo-tenant";
import { customPlanName } from "@/lib/constants";

export type CustomerRow = {
  id: string;
  name: string;
  type: string;
  onboarded: boolean;
  isActive: boolean; // false = suspended/blocked
  ownerEmail: string | null;
  ownerId: string | null;
  /** Plan name to show — a custom plan is named after the center. */
  plan: string;
  planCode: string;
  planStatus: string;
  /** Custom plan only: this center's own monthly amount. null = no custom plan. */
  customPrice: number | null;
  /** Custom plan only: this center's own student cap. null = no custom plan. */
  customStudents: number | null;
  students: number;
  activeStudents: number;
  revenue: number; // rupees collected (successful payments)
  pending: number; // rupees outstanding (unpaid fee balance)
  createdAt: string;
};

/** All customers with rolled-up metrics (super-admin only). */
export async function listCustomers(): Promise<CustomerRow[]> {
  await requireSuperAdmin();

  // Exclude the isolated demo tenants so they never mix with real customers.
  const rows = await db.select().from(institutes).where(notInArray(institutes.id, DEMO_INSTITUTE_IDS));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Aggregate in a few grouped queries, then stitch together in JS.
  const [studentCounts, activeCounts, revenueRows, pendingRows, owners, subs] = await Promise.all([
    db.select({ id: students.instituteId, n: count() }).from(students).where(inArray(students.instituteId, ids)).groupBy(students.instituteId),
    db.select({ id: students.instituteId, n: count() }).from(students).where(and(inArray(students.instituteId, ids), eq(students.status, "active"))).groupBy(students.instituteId),
    db.select({ id: payments.instituteId, total: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(inArray(payments.instituteId, ids), eq(payments.status, "success"))).groupBy(payments.instituteId),
    db.select({ id: fees.instituteId, total: sql<number>`coalesce(sum(${fees.amount} - ${fees.amountPaid}), 0)` }).from(fees).where(and(inArray(fees.instituteId, ids), inArray(fees.status, ["pending", "overdue", "partial"]))).groupBy(fees.instituteId),
    db.select({ id: users.instituteId, email: users.email, userId: users.id }).from(users).where(and(inArray(users.instituteId, ids), eq(users.role, "institute_admin"))),
    db.select({ id: subscriptions.instituteId, plan: subscriptionPlans.name, code: subscriptionPlans.code, status: subscriptions.status, customPrice: subscriptions.customPriceMonthly, customStudents: subscriptions.customMaxStudents }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id)).where(inArray(subscriptions.instituteId, ids)),
  ]);

  const num = (rs: { id: string; n?: number; total?: number }[], id: string, key: "n" | "total") =>
    Number(rs.find((r) => r.id === id)?.[key] ?? 0);

  return rows.map((inst) => {
    const owner = owners.find((o) => o.id === inst.id);
    const sub = subs.find((s) => s.id === inst.id);
    return {
      id: inst.id,
      name: inst.name,
      type: inst.type,
      onboarded: inst.onboarded,
      isActive: inst.isActive,
      ownerEmail: owner?.email ?? null,
      ownerId: owner?.userId ?? null,
      // A custom plan overrides the plan it sits on, name included.
      plan: sub?.customPrice != null && sub?.customStudents != null
        ? customPlanName(inst.name, sub.customPrice, sub.customStudents)
        : (sub?.plan ?? "—"),
      planCode: sub?.code ?? "",
      planStatus: sub?.status ?? "—",
      customPrice: sub?.customPrice ?? null,
      customStudents: sub?.customStudents ?? null,
      students: num(studentCounts, inst.id, "n"),
      activeStudents: num(activeCounts, inst.id, "n"),
      revenue: num(revenueRows, inst.id, "total"),
      pending: num(pendingRows, inst.id, "total"),
      createdAt: inst.createdAt.toISOString(),
    };
  });
}

/** Enter a customer's center to manage their data (impersonation). */
export async function openCenter(formData: FormData) {
  await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  if (!instituteId) return;
  const store = await cookies();
  store.set(ACTING_COOKIE, instituteId, ACTING_COOKIE_OPTIONS);
  redirect("/dashboard");
}

/** Stop managing a center and return to the caller's console (platform admin
 *  for super_admin, Head-Office for org_admin). */
export async function exitCenter() {
  const profile = await getCurrentProfile();
  const store = await cookies();
  store.delete(ACTING_COOKIE);
  redirect(profile?.role === "org_admin" ? "/org" : "/admin");
}

/** Suspend or re-activate a center (super-admin only). A suspended center's
 *  owner & staff are locked out until re-activated (e.g. for non-payment). */
export async function setCenterActive(formData: FormData) {
  await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!instituteId) return;
  await db.update(institutes).set({ isActive: active }).where(eq(institutes.id, instituteId));
  revalidatePath("/admin");
}

/** Permanently delete a center and ALL its data (super-admin only).
 *  Every tenant-owned table cascades on institute_id, so removing the
 *  institute row wipes students, fees, payments, users, etc. Irreversible. */
export async function deleteCenter(formData: FormData): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!instituteId) return { error: "Missing center" };

  const [inst] = await db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, instituteId)).limit(1);
  if (!inst) return { error: "Center not found" };
  if (confirmName !== inst.name) return { error: "Type the center name exactly to confirm" };

  await db.delete(institutes).where(eq(institutes.id, instituteId));
  revalidatePath("/admin");
  return {};
}

/** Reset any center owner's password (super-admin only). */
export async function resetOwnerPassword(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!userId || newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
  revalidatePath("/admin");
  return { ok: true };
}

// ── Platform metrics (your business, not a customer's) ───────────────
export type PlatformMetrics = {
  mrr: number; // sum of active + past_due subscription plan prices (rupees/mo)
  arr: number;
  activeSubs: number;
  trialingSubs: number;
  pastDueSubs: number;
  totalCollected: number; // across all centers
  totalPending: number;
  byPlan: { code: string; name: string; price: number; count: number; mrr: number }[];
};

/** Roll up the platform's own subscription revenue (super-admin only). */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  await requireSuperAdmin();

  // All aggregates exclude the isolated demo tenants so your real revenue is clean.
  const notDemo = notInArray(subscriptions.instituteId, DEMO_INSTITUTE_IDS);
  const [subRows, collectedRow, pendingRow] = await Promise.all([
    db.select({
      status: subscriptions.status,
      code: subscriptionPlans.code,
      name: subscriptionPlans.name,
      price: subscriptionPlans.priceMonthly,
      customPrice: subscriptions.customPriceMonthly,
    }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id)).where(notDemo),
    db.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.status, "success"), notInArray(payments.instituteId, DEMO_INSTITUTE_IDS))),
    db.select({ total: sql<number>`coalesce(sum(${fees.amount} - ${fees.amountPaid}), 0)` }).from(fees).where(and(inArray(fees.status, ["pending", "overdue", "partial"]), notInArray(fees.instituteId, DEMO_INSTITUTE_IDS))),
  ]);

  const billable = subRows.filter((s) => s.status === "active" || s.status === "past_due");
  // A custom center pays its own negotiated figure, not the plan's price.
  const monthly = (s: { price: number; customPrice: number | null }) =>
    Number(s.customPrice ?? s.price);
  const mrr = billable.reduce((a, s) => a + monthly(s), 0);

  // Custom centers each pay a different figure, so they roll up into one
  // "Custom" line rather than one line per center.
  const byPlanMap = new Map<string, { code: string; name: string; price: number; count: number; mrr: number }>();
  for (const s of billable) {
    const key = s.customPrice == null ? s.code : "custom";
    const e = byPlanMap.get(key) ?? { code: key, name: s.customPrice == null ? s.name : "Custom", price: Number(s.customPrice ?? s.price), count: 0, mrr: 0 };
    e.count += 1;
    e.mrr += monthly(s);
    byPlanMap.set(key, e);
  }

  return {
    mrr,
    arr: mrr * 12,
    activeSubs: subRows.filter((s) => s.status === "active").length,
    trialingSubs: subRows.filter((s) => s.status === "trialing").length,
    pastDueSubs: subRows.filter((s) => s.status === "past_due").length,
    totalCollected: Number(collectedRow[0]?.total ?? 0),
    totalPending: Number(pendingRow[0]?.total ?? 0),
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrr - a.mrr),
  };
}

export type PlanOption = { id: string; code: string; name: string; price: number; maxStudents: number | null };

/** The plan catalogue for the plan-override dropdown (super-admin only). */
export async function listPlans(): Promise<PlanOption[]> {
  await requireSuperAdmin();
  const rows = await db
    .select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, price: subscriptionPlans.priceMonthly, maxStudents: subscriptionPlans.maxStudents })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
  return rows;
}

const SUB_STATUSES = ["trialing", "active", "past_due", "canceled", "expired"] as const;
type SubStatus = (typeof SUB_STATUSES)[number];

/**
 * Override a center's plan and/or subscription status (super-admin only).
 *
 * A custom plan is optional and sits on TOP of the selected plan: give both an
 * amount and a student count and they win over the plan's price and cap
 * everywhere, under a plan named after the center. Leave both blank and the
 * selected plan applies exactly as before — which is how any existing center
 * that is never given a custom plan keeps behaving.
 */
export async function setCenterPlan(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const status = String(formData.get("status") ?? "active") as SubStatus;
  if (!instituteId || !planId) return { error: "Missing center or plan" };
  if (!SUB_STATUSES.includes(status)) return { error: "Invalid status" };

  const [plan] = await db
    .select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, maxStudents: subscriptionPlans.maxStudents })
    .from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  if (!plan) return { error: "Plan not found" };

  // Custom plan: both fields, or neither. Half of one would leave a center with
  // an amount and no cap (or the reverse), which no screen could explain.
  const rawPrice = String(formData.get("customPrice") ?? "").trim();
  const rawStudents = String(formData.get("customStudents") ?? "").trim();
  let customPriceMonthly: number | null = null;
  let customMaxStudents: number | null = null;
  if (rawPrice !== "" || rawStudents !== "") {
    customPriceMonthly = Number(rawPrice);
    customMaxStudents = Number(rawStudents);
    if (!Number.isInteger(customPriceMonthly) || customPriceMonthly < 0) {
      return { error: "Enter the custom monthly amount in rupees (0 or more), or clear both custom fields" };
    }
    if (!Number.isInteger(customMaxStudents) || customMaxStudents < 1) {
      return { error: "Enter the custom student limit (at least 1), or clear both custom fields" };
    }
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + (status === "trialing" ? 14 : 30));

  const [existing] = await db.select({ id: subscriptions.id, extraStudents: subscriptions.extraStudents })
    .from(subscriptions).where(eq(subscriptions.instituteId, instituteId)).limit(1);
  if (existing) {
    await db.update(subscriptions)
      .set({ planId, status, customPriceMonthly, customMaxStudents, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd, updatedAt: new Date() })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ instituteId, planId, status, customPriceMonthly, customMaxStudents, currentPeriodEnd: periodEnd });
  }

  // Record it in the capacity history so "why do I have this limit?" always has
  // an answer — a plan change moves the cap just as much as buying seats does.
  const extra = existing?.extraStudents ?? 0;
  const planCap = customMaxStudents ?? plan.maxStudents;
  const [inst] = await db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, instituteId)).limit(1);
  await db.insert(capacityEvents).values({
    instituteId,
    action: existing ? "plan_changed" : "plan_set",
    delta: 0,
    resultingCap: planCap == null ? null : planCap + extra,
    planCode: plan.code,
    actor: "admin",
    actorName: "Super admin",
    notes: customPriceMonthly === null || customMaxStudents === null
      ? `${plan.name} plan · ${status}`
      : `Custom plan · ${customPlanName(inst?.name ?? "", customPriceMonthly, customMaxStudents)} · on ${plan.name} · ${status}`,
  });

  revalidatePath("/admin");
  return { ok: true };
}
