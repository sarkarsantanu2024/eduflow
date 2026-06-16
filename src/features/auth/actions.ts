"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { DEMO_MODE, DEMO_COOKIE } from "@/lib/demo";
import {
  loginSchema, registerSchema, forgotPasswordSchema, otpRequestSchema, otpVerifySchema,
} from "./schema";

export type AuthState = { error?: string } | undefined;

/** OTP flow needs to remember it has sent a code (and to which email). */
export type OtpState = { error?: string; sent?: boolean; email?: string } | undefined;

async function setDemoCookie() {
  const store = await cookies();
  store.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h demo session
  });
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  // Demo mode: accept any credentials, set a cookie, no backend required.
  if (DEMO_MODE) {
    await setDemoCookie();
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Google OAuth sign-in. In demo mode we shortcut to a demo session; with
 * Supabase configured this kicks off the real OAuth redirect dance.
 */
export async function signInWithGoogle() {
  if (DEMO_MODE) {
    await setDemoCookie();
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url); // hand off to Google's consent screen
}

/** Step 1 of passwordless login — email the user a one-time code. */
export async function requestOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const parsed = otpRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid email" };
  const { email } = parsed.data;

  // Demo mode: pretend the code was sent (any 6 digits will verify below).
  if (DEMO_MODE) return { sent: true, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return { error: error.message };
  return { sent: true, email };
}

/** Step 2 of passwordless login — verify the one-time code and sign in. */
export async function verifyOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const parsed = otpVerifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message ?? "Invalid code",
      sent: true,
      email: String(formData.get("email") ?? ""),
    };
  }
  const { email, token } = parsed.data;

  // Demo mode: accept any 6-digit code.
  if (DEMO_MODE) {
    await setDemoCookie();
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: error.message, sent: true, email };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Self-serve signup: creates the auth user, a new institute (tenant), and
 * binds the user as its institute_admin. Tenant creation uses the service
 * role so it isn't blocked by RLS before the profile exists.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { instituteName, fullName, email, password } = parsed.data;

  // Demo mode: skip tenant/user creation, just start a demo session.
  if (DEMO_MODE) {
    await setDemoCookie();
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // 1) Create the tenant.
  const slug = `${slugify(instituteName)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: institute, error: instErr } = await admin
    .from("institutes")
    .insert({ name: instituteName, slug })
    .select("id")
    .single();
  if (instErr || !institute) return { error: instErr?.message ?? "Could not create institute" };

  const instituteId = institute.id;

  // 2) Create the auth user. handle_new_user() trigger seeds the profile
  //    from user_metadata (institute_id + role).
  const { error: signErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "institute_admin", institute_id: instituteId },
  });
  if (signErr) {
    // Roll back the orphaned tenant.
    await admin.from("institutes").delete().eq("id", instituteId);
    return { error: signErr.message };
  }

  // 3) Sign the user in.
  const supabase = await createClient();
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  if (loginErr) redirect("/login");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid email" };

  if (DEMO_MODE) return undefined; // pretend success in demo

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/settings/password`,
  });
  // Always succeed to avoid leaking which emails are registered.
  return undefined;
}

export async function updatePassword(password: string): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return undefined;
}

export async function signOut() {
  if (DEMO_MODE) {
    const store = await cookies();
    store.delete(DEMO_COOKIE);
    revalidatePath("/", "layout");
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
