"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { requireProfile } from "@/lib/auth";
import { requireActiveInstituteId } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth/password";

export type StaffRow = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export type StaffData = {
  staff: StaffRow[];
  limit: number | null; // null = unlimited
  planName: string;
};

/** Only the center owner (or a super-admin helping them) manages staff. */
async function requireOwner(): Promise<string> {
  const profile = await requireProfile();
  if (profile.role !== "institute_admin" && profile.role !== "super_admin") {
    throw new Error("Forbidden: only the center owner can manage staff");
  }
  return requireActiveInstituteId();
}

/** Staff logins for the active center + the plan's staff limit. */
export async function listStaff(): Promise<StaffData> {
  const instituteId = await requireOwner();

  const staff = await db
    .select({ id: users.id, fullName: users.fullName, username: users.username, email: users.email, isActive: users.isActive, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(and(eq(users.instituteId, instituteId), eq(users.role, "teacher")));

  const sub = await db
    .select({ maxStaff: subscriptionPlans.maxStaff, planName: subscriptionPlans.name })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.instituteId, instituteId))
    .limit(1);

  return {
    staff: staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null })),
    limit: sub[0]?.maxStaff ?? 1,
    planName: sub[0]?.planName ?? "Starter",
  };
}

/** Create a teacher (staff) login, enforcing the plan's staff limit. */
export async function createStaff(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const instituteId = await requireOwner();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!fullName) return { error: "Name is required" };
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Username must be 3–40 chars (letters, numbers, . _ -)" };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  // Enforce plan staff limit.
  const data = await listStaff();
  if (data.limit !== null && data.staff.length >= data.limit) {
    return { error: `Your ${data.planName} plan allows ${data.limit} staff login${data.limit === 1 ? "" : "s"}. Upgrade your plan to add more.` };
  }

  // Username is the login — must be globally unique.
  const existingUsername = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existingUsername) return { error: "That username is already taken" };
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { error: "An account with this email already exists" };

  await db.insert(users).values({
    username,
    email,
    passwordHash: await hashPassword(password),
    fullName,
    role: "teacher",
    instituteId,
  });
  return { ok: true };
}

/** Reset a staff member's password (must belong to the active center). */
export async function resetStaffPassword(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const instituteId = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const staff = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!staff || staff.instituteId !== instituteId || staff.role !== "teacher") return { error: "Staff member not found" };

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
  return { ok: true };
}

/** Enable/disable a staff login. */
export async function setStaffActive(formData: FormData): Promise<void> {
  const instituteId = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db.update(users).set({ isActive: active }).where(and(eq(users.id, userId), eq(users.instituteId, instituteId), eq(users.role, "teacher")));
  revalidatePath("/staff");
}

/** Permanently remove a staff login. */
export async function deleteStaff(formData: FormData): Promise<void> {
  const instituteId = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  await db.delete(users).where(and(eq(users.id, userId), eq(users.instituteId, instituteId), eq(users.role, "teacher")));
  revalidatePath("/staff");
}
