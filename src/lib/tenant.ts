import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { institutes } from "@/lib/db/schema";
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

export const getActiveInstituteId = cache(async (): Promise<string | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (!isConsoleRole(profile.role)) return profile.institute_id;

  const store = await cookies();
  const cookieId = store.get(ACTING_COOKIE)?.value ?? null;
  if (!cookieId) return null;

  // A super-admin may open any center — that's the platform owner.
  if (profile.role === "super_admin") return cookieId;

  // An org_admin may ONLY open a branch inside their own organization. The
  // cookie is an unsigned id supplied by the client (httpOnly stops scripts
  // reading it, not a crafted request from setting it), so checking ownership
  // only where the cookie is written is not enough — a forged value would
  // otherwise grant full read/write on another franchise's center. Re-verify
  // on every read; `cache` keeps it to one query per request.
  if (!profile.organization_id) return null;
  const [branch] = await db
    .select({ id: institutes.id })
    .from(institutes)
    .where(and(eq(institutes.id, cookieId), eq(institutes.organizationId, profile.organization_id)))
    .limit(1);
  return branch?.id ?? null;
});

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
  // Goes through the verified resolver, so a forged cookie can't light up the
  // "managing this center" banner for a center the caller can't actually open.
  return Boolean(await getActiveInstituteId());
}

/** Cookie options for the acting-institute cookie. Set in one place so the
 *  admin and Head-Office entry points can't drift apart. */
export const ACTING_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;
