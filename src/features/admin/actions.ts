"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  institutes, users, students, payments, fees, subscriptions, subscriptionPlans,
} from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ACTING_COOKIE } from "@/lib/tenant";

export type CustomerRow = {
  id: string;
  name: string;
  type: string;
  onboarded: boolean;
  isActive: boolean; // false = suspended/blocked
  ownerEmail: string | null;
  ownerId: string | null;
  plan: string;
  planStatus: string;
  students: number;
  activeStudents: number;
  revenue: number; // rupees collected (successful payments)
  pending: number; // rupees outstanding (unpaid fee balance)
  createdAt: string;
};

/** All customers with rolled-up metrics (super-admin only). */
export async function listCustomers(): Promise<CustomerRow[]> {
  await requireSuperAdmin();

  const rows = await db.select().from(institutes);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Aggregate in a few grouped queries, then stitch together in JS.
  const [studentCounts, activeCounts, revenueRows, pendingRows, owners, subs] = await Promise.all([
    db.select({ id: students.instituteId, n: count() }).from(students).where(inArray(students.instituteId, ids)).groupBy(students.instituteId),
    db.select({ id: students.instituteId, n: count() }).from(students).where(and(inArray(students.instituteId, ids), eq(students.status, "active"))).groupBy(students.instituteId),
    db.select({ id: payments.instituteId, total: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(inArray(payments.instituteId, ids), eq(payments.status, "success"))).groupBy(payments.instituteId),
    db.select({ id: fees.instituteId, total: sql<number>`coalesce(sum(${fees.amount} - ${fees.amountPaid}), 0)` }).from(fees).where(and(inArray(fees.instituteId, ids), inArray(fees.status, ["pending", "overdue", "partial"]))).groupBy(fees.instituteId),
    db.select({ id: users.instituteId, email: users.email, userId: users.id }).from(users).where(and(inArray(users.instituteId, ids), eq(users.role, "institute_admin"))),
    db.select({ id: subscriptions.instituteId, plan: subscriptionPlans.name, status: subscriptions.status }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id)).where(inArray(subscriptions.instituteId, ids)),
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
      plan: sub?.plan ?? "—",
      planStatus: sub?.status ?? "—",
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
  store.set(ACTING_COOKIE, instituteId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

/** Stop managing a center and return to the admin console. */
export async function exitCenter() {
  const store = await cookies();
  store.delete(ACTING_COOKIE);
  redirect("/admin");
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
