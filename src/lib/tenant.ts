import "server-only";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";

/**
 * The "active institute" is the tenant whose data the current request reads
 * and writes:
 *   - institute_admin / teacher → always their own institute.
 *   - super_admin → the institute they've chosen to "open" (impersonation),
 *     stored in a cookie. null until they pick one.
 *
 * Every data action scopes to this id, so the same screens serve both a
 * customer running their center and a super-admin helping them.
 */
export const ACTING_COOKIE = "eduflow_acting_institute";

export async function getActiveInstituteId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (profile.role === "super_admin") {
    const store = await cookies();
    return store.get(ACTING_COOKIE)?.value ?? null;
  }
  return profile.institute_id;
}

/** Throws if there's no active institute (used by data actions). */
export async function requireActiveInstituteId(): Promise<string> {
  const id = await getActiveInstituteId();
  if (!id) throw new Error("No active institute — a super-admin must open a center first.");
  return id;
}

/** True when the current super-admin is operating inside a customer's center. */
export async function isImpersonating(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") return false;
  const store = await cookies();
  return Boolean(store.get(ACTING_COOKIE)?.value);
}
