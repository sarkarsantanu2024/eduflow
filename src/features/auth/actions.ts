"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn as nextSignIn, signOut as nextSignOut } from "@/auth";
// (Google OAuth removed — email/password only.)
import { db } from "@/lib/db";
import { institutes, users, subscriptions, subscriptionPlans, templates } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentProfile } from "@/lib/auth";
import { getSector } from "@/lib/sectors";
import { loginSchema, registerSchema, forgotPasswordSchema } from "./schema";

export type AuthState = { error?: string } | undefined;
export type PasswordState = { error?: string; ok?: boolean } | undefined;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

/** Email + password sign-in via Auth.js credentials. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  try {
    await nextSignIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password" };
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
  const { instituteName, type, fullName, email, password } = parsed.data;
  const lowerEmail = email.toLowerCase();

  const existing = await db.query.users.findFirst({ where: eq(users.email, lowerEmail) });
  if (existing) return { error: "An account with this email already exists" };

  const slug = `${slugify(instituteName)}-${Math.random().toString(36).slice(2, 6)}`;
  const [institute] = await db
    .insert(institutes)
    .values({ name: instituteName, slug, type, ownerName: fullName })
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

  // Seed ready-to-use WhatsApp templates tuned to this sector.
  const sectorTemplates = getSector(type).seedTemplates.map((t) => ({
    instituteId: institute.id, name: t.name, type: t.type, channel: "whatsapp", body: t.body,
  }));
  if (sectorTemplates.length) await db.insert(templates).values(sectorTemplates);

  await db.insert(users).values({
    email: lowerEmail,
    passwordHash: await hashPassword(password),
    fullName,
    role: "institute_admin",
    instituteId: institute.id,
  });

  try {
    await nextSignIn("credentials", { email: lowerEmail, password, redirect: false });
  } catch {
    redirect("/login");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
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
