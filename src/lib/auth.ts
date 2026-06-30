import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { ProfileRow, UserRole } from "@/types/database.types";

/** Map a DB user row to the ProfileRow shape the app's UI components expect. */
function toProfile(u: typeof users.$inferSelect): ProfileRow {
  return {
    id: u.id,
    institute_id: u.instituteId,
    role: u.role,
    full_name: u.fullName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    avatar_url: u.avatarUrl,
    is_active: u.isActive,
    last_login_at: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
    created_by: null,
    updated_by: null,
  };
}

/**
 * Returns the signed-in user's profile (with tenant + role), or null.
 * `cache` dedupes the work across a single render pass.
 */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user || !user.isActive) return null;

  return toProfile(user);
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
  // A super_admin has no tenant of their own — send them to their console.
  if (!profile.institute_id) {
    redirect(profile.role === "super_admin" ? "/admin" : "/onboarding");
  }
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

/** Convenience guard for the super-admin console. */
export async function requireSuperAdmin(): Promise<ProfileRow> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/dashboard");
  return profile;
}
