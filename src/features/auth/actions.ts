"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn as nextSignIn, signOut as nextSignOut } from "@/auth";
// (Google OAuth removed — email/password only.)
import { db } from "@/lib/db";
import { institutes, organizations, users, subscriptions, subscriptionPlans, templates, courses } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentProfile } from "@/lib/auth";
import { getSector } from "@/lib/sectors";
import { FEATURES } from "@/lib/features";
import { loginSchema, registerSchema, registerOrgSchema, forgotPasswordSchema } from "./schema";

export type AuthState = { error?: string } | undefined;
export type PasswordState = { error?: string; ok?: boolean } | undefined;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

/** Username + password sign-in via Auth.js credentials. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  try {
    await nextSignIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid username or password" };
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Self-serve signup: creates the institute (tenant), an institute_admin user,
 * and a trial Starter subscription, then signs the user in.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { instituteName, type, fullName, username, email, phone, address, password } = parsed.data;
  const lowerEmail = email.toLowerCase();
  const lowerUsername = username.toLowerCase();

  const existingUsername = await db.query.users.findFirst({ where: eq(users.username, lowerUsername) });
  if (existingUsername) return { error: "That username is already taken" };

  const existing = await db.query.users.findFirst({ where: eq(users.email, lowerEmail) });
  if (existing) return { error: "An account with this email already exists" };

  const slug = `${slugify(instituteName)}-${Math.random().toString(36).slice(2, 6)}`;
  const [institute] = await db
    .insert(institutes)
    .values({ name: instituteName, slug, type, ownerName: fullName, email: lowerEmail, phone, address: address || null })
    .returning();
  if (!institute) return { error: "Could not create institute" };

  // Trial Starter subscription.
  const starter = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.code, "starter"),
  });
  if (starter) {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14);
    await db.insert(subscriptions).values({
      instituteId: institute.id,
      planId: starter.id,
      status: "trialing",
      currentPeriodEnd: periodEnd,
      trialEndsAt: periodEnd,
    });
  }

  const sector = getSector(type);

  // Seed the sector's default course / level set so the new centre's dropdowns
  // (e.g. the student form's Course/Level) are ready to use out of the box.
  const sectorCourses = sector.seedCourses.map((c) => ({
    instituteId: institute.id, name: c.name, description: c.description,
  }));
  if (sectorCourses.length) await db.insert(courses).values(sectorCourses);

  // Seed ready-to-use WhatsApp templates tuned to this sector.
  const sectorTemplates = sector.seedTemplates.map((t) => ({
    instituteId: institute.id, name: t.name, type: t.type, channel: "whatsapp", body: t.body,
  }));
  if (sectorTemplates.length) await db.insert(templates).values(sectorTemplates);

  await db.insert(users).values({
    username: lowerUsername,
    email: lowerEmail,
    phone,
    passwordHash: await hashPassword(password),
    fullName,
    role: "institute_admin",
    instituteId: institute.id,
  });

  try {
    await nextSignIn("credentials", { username: lowerUsername, password, redirect: false });
  } catch {
    redirect("/login");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Self-serve signup for a multi-center brand (Head Office). Creates the
 * organization + its owner (org_admin) login, signs in, and lands on the
 * Head-Office console where the owner creates their branches. Gated by the
 * Head-Office feature flag.
 */
export async function signUpOrganization(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!FEATURES.headOffice) return { error: "Multi-center signup isn't available right now." };

  const parsed = registerOrgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { organizationName, fullName, username, email, phone, password } = parsed.data;

  const lowerUsername = username.toLowerCase();
  const lowerEmail = (email ?? "").toLowerCase();

  const existingUsername = await db.query.users.findFirst({ where: eq(users.username, lowerUsername) });
  if (existingUsername) return { error: "That username is already taken" };
  if (lowerEmail) {
    const existingEmail = await db.query.users.findFirst({ where: eq(users.email, lowerEmail) });
    if (existingEmail) return { error: "An account with this email already exists" };
  }

  const slug = `${slugify(organizationName)}-${Math.random().toString(36).slice(2, 6)}`;
  const [org] = await db
    .insert(organizations)
    .values({ name: organizationName, slug, ownerName: fullName, email: lowerEmail || null, phone: phone || null })
    .returning({ id: organizations.id });
  if (!org) return { error: "Could not create the organization" };

  // Email is optional (username is the login) — synthesize a unique placeholder.
  await db.insert(users).values({
    organizationId: org.id,
    instituteId: null,
    role: "org_admin",
    username: lowerUsername,
    email: lowerEmail || `${lowerUsername}@noemail.eduflow.local`,
    phone: phone || null,
    fullName,
    passwordHash: await hashPassword(password),
  });

  try {
    await nextSignIn("credentials", { username: lowerUsername, password, redirect: false });
  } catch {
    redirect("/login");
  }
  revalidatePath("/", "layout");
  redirect("/org");
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid email" };
  // Email delivery isn't wired yet; always succeed to avoid leaking which
  // emails are registered. (TODO: send a reset link once an email provider
  // is configured.)
  return undefined;
}

/** Change the signed-in user's own password (works for any role). */
export async function changeOwnPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You are not signed in" };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters" };
  if (next !== confirm) return { error: "New passwords do not match" };

  const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) });
  if (!user) return { error: "Account not found" };

  // If they already have a password, verify the current one first.
  if (user.passwordHash) {
    const ok = await verifyPassword(current, user.passwordHash);
    if (!ok) return { error: "Current password is incorrect" };
  }

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, profile.id));
  return { ok: true };
}

export async function signOut() {
  await nextSignOut({ redirect: false });
  revalidatePath("/", "layout");
  redirect("/login");
}
