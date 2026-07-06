"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, institutes, users } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** Synthetic address used when a login is created without a real email. */
const NO_EMAIL_SUFFIX = "@noemail.eduflow.local";

export type OrgRow = {
  id: string;
  name: string;
  partnerSharePercent: number;
  isActive: boolean;
  branches: number;
  adminUserId: string | null;
  adminUsername: string | null;
  adminEmail: string | null;
};

export type AssignCenterRow = {
  id: string;
  name: string;
  organizationId: string | null;
};

/** All organizations with branch counts and their owner login (super-admin only). */
export async function listOrganizations(): Promise<OrgRow[]> {
  await requireSuperAdmin();

  const [orgs, branchCounts, admins] = await Promise.all([
    db.select().from(organizations),
    db.select({ id: institutes.organizationId, n: count() }).from(institutes).groupBy(institutes.organizationId),
    db.select({ orgId: users.organizationId, userId: users.id, username: users.username, email: users.email }).from(users).where(eq(users.role, "org_admin")),
  ]);

  return orgs.map((o) => {
    const admin = admins.find((a) => a.orgId === o.id);
    // Hide the synthetic placeholder email from the UI.
    const email = admin?.email && !admin.email.endsWith(NO_EMAIL_SUFFIX) ? admin.email : null;
    return {
      id: o.id,
      name: o.name,
      partnerSharePercent: o.partnerSharePercent,
      isActive: o.isActive,
      branches: Number(branchCounts.find((b) => b.id === o.id)?.n ?? 0),
      adminUserId: admin?.userId ?? null,
      adminUsername: admin?.username ?? null,
      adminEmail: email,
    };
  });
}

/** Every center + its current org, so the admin can attach/detach branches. */
export async function listCentersForAssign(): Promise<AssignCenterRow[]> {
  await requireSuperAdmin();
  const rows = await db
    .select({ id: institutes.id, name: institutes.name, organizationId: institutes.organizationId })
    .from(institutes);
  return rows;
}

/** Create a new organization (franchise / multi-center brand). */
export async function createOrganization(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const share = Math.max(0, Math.min(100, Number(formData.get("partnerSharePercent") ?? 0)));
  if (name.length < 2) return { error: "Enter an organization name" };

  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(organizations).values({ name, slug, partnerSharePercent: share });
  revalidatePath("/admin/organizations");
  return { ok: true };
}

/** Update an organization's name, partner share %, or active flag. */
export async function updateOrganization(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const id = String(formData.get("orgId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const share = Math.max(0, Math.min(100, Number(formData.get("partnerSharePercent") ?? 0)));
  if (!id) return { error: "Missing organization" };
  if (name.length < 2) return { error: "Enter an organization name" };

  await db.update(organizations).set({ name, partnerSharePercent: share, updatedAt: new Date() }).where(eq(organizations.id, id));
  revalidatePath("/admin/organizations");
  return { ok: true };
}

/** Attach a center to an organization (or detach when organizationId is empty). */
export async function assignBranch(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "") || null;
  if (!instituteId) return { error: "Pick a center" };

  await db.update(institutes).set({ organizationId }).where(eq(institutes.id, instituteId));
  revalidatePath("/admin/organizations");
  return { ok: true };
}

/** Create the franchise-owner (org_admin) login for an organization. */
export async function createOrgAdmin(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireSuperAdmin();
  const organizationId = String(formData.get("orgId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!organizationId) return { error: "Missing organization" };
  if (username.length < 3) return { error: "Username must be at least 3 characters" };
  if (email && !email.includes("@")) return { error: "Enter a valid email (or leave it blank)" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const [existsUser, existsEmail] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.username, username) }),
    email ? db.query.users.findFirst({ where: eq(users.email, email) }) : Promise.resolve(undefined),
  ]);
  if (existsUser) return { error: "That username is already taken" };
  if (email && existsEmail) return { error: "An account with this email already exists" };

  // Email is optional (username is the login). Synthesize a unique placeholder
  // when blank, since the column is NOT NULL + unique.
  const finalEmail = email || `${username}${NO_EMAIL_SUFFIX}`;

  await db.insert(users).values({
    organizationId,
    instituteId: null,
    role: "org_admin",
    username,
    email: finalEmail,
    fullName,
    passwordHash: await hashPassword(password),
  });
  revalidatePath("/admin/organizations");
  return { ok: true };
}
