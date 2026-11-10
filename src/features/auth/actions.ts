"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
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
import { clientIp, hit, isLimited, LIMITS } from "@/lib/rate-limit";
import type { BatchItem } from "drizzle-orm/batch";

/**
 * One statement list for db.batch. The neon-http driver has no
 * db.transaction(), but batch() runs its statements in one transaction, so a
 * sign-up either creates everything or nothing. Before this, a failure between
 * the institute insert and the user insert left an orphan tenant with a trial
 * subscription and no owner — and the person who signed up got an error with
 * their username and email now "already taken" on retry.
 */
type Statements = [BatchItem<"pg">, ...BatchItem<"pg">[]];

export type AuthState = { error?: string } | undefined;
export type PasswordState = { error?: string; ok?: boolean } | undefined;

/**
 * Every sign-up creates a real tenant in the production database, so each
 * attempt counts (not only failures). Returns the form error when limited.
 */
async function signupLimited(): Promise<AuthState> {
  const key = `signup:ip:${clientIp(await headers())}`;
  if (await isLimited(key, LIMITS.signupPerIp)) {
    return { error: "Too many sign-ups from this network. Please try again in an hour." };
  }
  await hit(key, LIMITS.signupPerIp);
  return undefined;
}

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
    if (error instanceof AuthError) {
      return {
        error: (error as AuthError & { code?: string }).code === "rate_limited"
          ? "Too many failed attempts. Please wait 15 minutes and try again."
          : "Invalid username or password",
      };
    }
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
  const limited = await signupLimited();
  if (limited) return limited;
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
  // The id is minted here, not by the database, so every dependent row can be
  // written in the same batch as the institute itself.
  const instituteId = randomUUID();

  // Trial Starter subscription (a read; the write joins the batch below).
  const starter = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.code, "starter"),
  });

  const sector = getSector(type);

  // Seed the sector's default course / level set so the new centre's dropdowns
  // (e.g. the student form's Course/Level) are ready to use out of the box.
  const sectorCourses = sector.seedCourses.map((c) => ({
    instituteId, name: c.name, description: c.description,
  }));

  // Seed ready-to-use WhatsApp templates tuned to this sector.
  const sectorTemplates = sector.seedTemplates.map((t) => ({
    instituteId, name: t.name, type: t.type, channel: "whatsapp", body: t.body,
  }));

  const passwordHash = await hashPassword(password);

  const statements: Statements = [
    db.insert(institutes).values({
      id: instituteId, name: instituteName, slug, type, ownerName: fullName, email: lowerEmail, phone, address: address || null,
    }),
  ];
  if (starter) {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14);
    statements.push(
      db.insert(subscriptions).values({
        instituteId,
        planId: starter.id,
        status: "trialing",
        currentPeriodEnd: periodEnd,
        trialEndsAt: periodEnd,
      }),
    );
  }
  if (sectorCourses.length) statements.push(db.insert(courses).values(sectorCourses));
  if (sectorTemplates.length) statements.push(db.insert(templates).values(sectorTemplates));
  statements.push(
    db.insert(users).values({
      username: lowerUsername,
      email: lowerEmail,
      phone,
      passwordHash,
      fullName,
      role: "institute_admin",
      instituteId,
    }),
  );

  try {
    await db.batch(statements);
  } catch (err) {
    // Most likely a unique clash that raced past the checks above. Nothing was
    // written, so the person can simply try again.
    console.error("[signUp] batch failed", err);
    return { error: "Could not create your account. Please try again." };
  }

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
  const limited = await signupLimited();
  if (limited) return limited;

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
  const organizationId = randomUUID();
  const passwordHash = await hashPassword(password);

  // Organization and its owner login in ONE transaction — see `Statements`.
  // Email is optional (username is the login) — synthesize a unique placeholder.
  try {
    await db.batch([
      db.insert(organizations).values({
        id: organizationId, name: organizationName, slug, ownerName: fullName, email: lowerEmail || null, phone: phone || null,
      }),
      db.insert(users).values({
        organizationId,
        instituteId: null,
        role: "org_admin",
        username: lowerUsername,
        email: lowerEmail || `${lowerUsername}@noemail.eduflow.local`,
        phone: phone || null,
        fullName,
        passwordHash,
      }),
    ]);
  } catch (err) {
    console.error("[signUpOrganization] batch failed", err);
    return { error: "Could not create the organization. Please try again." };
  }

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
