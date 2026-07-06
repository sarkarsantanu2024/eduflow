import "server-only";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";

/**
 * The "active institute" is the tenant whose data the current request reads
 * and writes:
 *   - institute_admin / teacher → always their own institute.
 *   - super_admin → the institute they've chosen to "open" (impersonation),
 *     stored in a cookie. null until they pick one.
 *   - org_admin (franchise owner) → a branch inside their own organization
 *     that they've chosen to "open" (same cookie). The branch is verified to
 *     belong to their org before the cookie is set (see features/org/actions).
 *
 * Every data action scopes to this id, so the same screens serve both a
 * customer running their center and a super-admin / org-admin helping them.
 */
export const ACTING_COOKIE = "eduflow_acting_institute";

/** Roles that operate above a single tenant and "open" a center to work in it. */
function isConsoleRole(role: string | undefined): boolean {
  return role === "super_admin" || role === "org_admin";
}

export async function getActiveInstituteId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (isConsoleRole(profile.role)) {
    const store = await cookies();
    return store.get(ACTING_COOKIE)?.value ?? null;
  }
  return profile.institute_id;
}

/** Throws if there's no active institute (used by data actions). */
export async function requireActiveInstituteId(): Promise<string> {
  const id = await getActiveInstituteId();
  if (!id) throw new Error("No active institute — open a center first.");
  return id;
}

/** The org a franchise owner is bound to (null for everyone else). */
export async function getActiveOrganizationId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.role === "org_admin") return profile.organization_id;
  return null;
}

/** True when a super-admin OR org-admin is operating inside a center. */
export async function isImpersonating(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!isConsoleRole(profile?.role)) return false;
  const store = await cookies();
  return Boolean(store.get(ACTING_COOKIE)?.value);
}
