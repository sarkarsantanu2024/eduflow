import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE, DEMO_COOKIE, demoProfile } from "@/lib/demo";
import type { ProfileRow, UserRole } from "@/types/database.types";

/**
 * Returns the signed-in user's profile (with tenant + role), or null.
 * `cache` dedupes the DB hit across a single render pass.
 */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  if (DEMO_MODE) {
    const store = await cookies();
    return store.get(DEMO_COOKIE)?.value ? demoProfile : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as ProfileRow) ?? null;
});

/** Guard for protected pages/actions. Redirects to /login if unauthenticated. */
export async function requireProfile(): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Guard requiring a tenant binding (everyone except a bare super_admin). */
export async function requireTenant(): Promise<ProfileRow & { institute_id: string }> {
  const profile = await requireProfile();
  if (!profile.institute_id) redirect("/onboarding");
  return profile as ProfileRow & { institute_id: string };
}

/** Throws if the caller's role isn't in the allowed set. */
export async function requireRole(...roles: UserRole[]): Promise<ProfileRow> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    throw new Error("Forbidden: insufficient role");
  }
  return profile;
}
