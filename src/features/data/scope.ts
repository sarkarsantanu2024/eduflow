import type { CollectionName, Db, Profile } from "@/lib/store/types";
import type { UserRole } from "@/types/database.types";

/**
 * What each role may READ of a centre's data.
 *
 * The client hydrates one `Db` object from `fetchDb()` and every screen reads
 * from it, so hiding a page in the sidebar hides nothing: until this existed a
 * teacher login received the whole tenant — every fee, payment and expense,
 * the owner's GST number and UPI ID — in the same payload the owner gets.
 * Writes were already role-checked (see `roleMayWrite` in actions.ts); this is
 * the read side of the same rule.
 *
 * Pure and dependency-free so it can be unit-tested without a database.
 */

const OWNER_ROLES = new Set<UserRole>(["institute_admin", "super_admin", "org_admin"]);

/**
 * The collections a teacher's screens use: Students, Batches, Attendance,
 * Promotions, Tests & Ranks, Performance, Events (see NAV_ITEMS). Everything
 * else — money, staff, templates, certificates, exam registrations, materials
 * and stationery — is the owner's and is never sent to a staff login.
 */
export const TEACHER_VISIBLE_COLLECTIONS: readonly CollectionName[] = [
  "students",
  "courses",
  "batches",
  "attendance",
  "promotions",
  "testScores",
  "performances",
  "events",
];

/** Profile fields a staff login has no business seeing: money and tax identity. */
export const OWNER_ONLY_PROFILE_FIELDS: readonly (keyof Profile)[] = [
  "gst",
  "upiId",
  "qrImage",
  "monthlyFee",
  "admissionFee",
  "reactivationFee",
  "hoRoyaltyPerStudent",
  "hoRoyaltyPercent",
  "recurringCharges",
];

export function isOwnerRole(role: UserRole | string): boolean {
  return OWNER_ROLES.has(role as UserRole);
}

/** May this role read this collection at all? */
export function roleMayRead(role: UserRole | string, collection: CollectionName): boolean {
  if (isOwnerRole(role)) return true;
  if (role === "teacher") return TEACHER_VISIBLE_COLLECTIONS.includes(collection);
  // `parent` and anything unrecognised: nothing. A parent portal, when it
  // exists, needs per-student scoping, not per-collection.
  return false;
}

/** The profile as this role may see it. Owners get it whole. */
export function scopeProfileForRole(role: UserRole | string, profile: Profile, empty: Profile): Profile {
  if (isOwnerRole(role)) return profile;
  const out: Profile = { ...profile };
  for (const field of OWNER_ONLY_PROFILE_FIELDS) {
    // Reset to the empty profile's value for that field so types line up
    // ("" for strings, 0 for numbers, [] for lists).
    (out as unknown as Record<string, unknown>)[field] = (empty as unknown as Record<string, unknown>)[field];
  }
  return out;
}

/** Apply both rules to a fully loaded Db. Used by fetchDb and by the tests. */
export function scopeDbForRole(role: UserRole | string, db: Db, empty: Db): Db {
  if (isOwnerRole(role)) return db;
  const out = { ...db } as unknown as Record<string, unknown>;
  for (const name of Object.keys(empty) as (keyof Db)[]) {
    if (name === "profile") continue;
    if (!roleMayRead(role, name)) out[name] = [];
  }
  out.profile = scopeProfileForRole(role, db.profile, empty.profile);
  return out as unknown as Db;
}
