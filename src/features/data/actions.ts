"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  institutes, students, courses, batches, templates, fees, payments, expenses,
  attendance, promotions, testScores, certificates, examRegs, performances,
  materials, adMaterials, stationery, events, teachers,
} from "@/lib/db/schema";
import { getActiveInstituteId, requireActiveInstituteId } from "@/lib/tenant";
import { requireProfile } from "@/lib/auth";
import { checkStudentCapacity, getStudentUsage, type StudentUsage } from "@/lib/plan-limits";
import {
  EMPTY_DB, EMPTY_PROFILE, DEFAULT_CERT_LAYOUT, DEFAULT_ID_CARD_DESIGN,
  type Db, type Profile, type CollectionName,
} from "@/lib/store/types";

/* ── Per-collection mapping config ───────────────────────────────────
 * rename:    client field ⇆ db column (only where names differ)
 * nullEmpty: db columns (date/uuid/enum) that must be null when "" */
type Cfg = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  rename: Record<string, string>;
  nullEmpty: string[];
};

const CONFIG: Record<CollectionName, Cfg> = {
  students: { table: students, rename: { photo: "photoUrl" }, nullEmpty: ["gender", "dob", "admissionDate", "courseId", "batchId", "photoUrl"] },
  courses: { table: courses, rename: {}, nullEmpty: [] },
  batches: { table: batches, rename: {}, nullEmpty: ["courseId"] },
  templates: { table: templates, rename: {}, nullEmpty: [] },
  fees: { table: fees, rename: {}, nullEmpty: ["studentId", "dueDate"] },
  payments: { table: payments, rename: {}, nullEmpty: ["studentId", "date"] },
  expenses: { table: expenses, rename: {}, nullEmpty: ["date"] },
  attendance: { table: attendance, rename: {}, nullEmpty: ["batchId", "studentId"] },
  promotions: { table: promotions, rename: {}, nullEmpty: ["studentId", "date"] },
  testScores: { table: testScores, rename: {}, nullEmpty: ["batchId", "studentId", "date"] },
  certificates: { table: certificates, rename: {}, nullEmpty: ["studentId", "issueDate"] },
  examRegs: { table: examRegs, rename: {}, nullEmpty: ["studentId", "examDate"] },
  performances: { table: performances, rename: {}, nullEmpty: ["studentId", "date"] },
  materials: { table: materials, rename: {}, nullEmpty: ["studentId", "date"] },
  adMaterials: { table: adMaterials, rename: {}, nullEmpty: ["date"] },
  stationery: { table: stationery, rename: {}, nullEmpty: ["date"] },
  events: { table: events, rename: {}, nullEmpty: ["date"] },
  teachers: { table: teachers, rename: {}, nullEmpty: ["joinDate"] },
};

const STRIP = new Set(["instituteId", "createdAt", "updatedAt", "deletedAt"]);

/* ── Who may write what ──────────────────────────────────────────────
 * `teacher` is a real login with a password (see features/staff/actions.ts),
 * handed to employees. Until now every write path here checked only that the
 * caller had a tenant, so a teacher could edit payments and expenses, empty
 * the whole center, or change the center's UPI ID so parents paid them
 * instead. Teaching staff get the day-to-day teaching collections; anything
 * that moves money or reshapes the center is the owner's.
 */
const TEACHER_WRITABLE = new Set<CollectionName>([
  "attendance",
  "testScores",
  "performances",
  "promotions",
]);

/** True when the role may write this collection. */
function roleMayWrite(role: string, collection: CollectionName): boolean {
  if (role === "institute_admin" || role === "super_admin" || role === "org_admin") return true;
  if (role === "teacher") return TEACHER_WRITABLE.has(collection);
  return false; // `parent` and anything unrecognised: read-only
}

/**
 * Resolve the tenant AND assert the caller may write `collection`.
 * Every write in this file goes through here, so a new collection is
 * owner-only by default rather than silently open to staff.
 */
async function requireWriteAccess(collection: CollectionName): Promise<string> {
  const profile = await requireProfile();
  if (!roleMayWrite(profile.role, collection)) {
    throw new Error(`Forbidden: your role cannot change ${collection}.`);
  }
  return requireActiveInstituteId();
}

/** Owner-only guard for center-wide operations (profile, bulk wipe). */
async function requireOwner(): Promise<string> {
  const profile = await requireProfile();
  if (profile.role !== "institute_admin" && profile.role !== "super_admin" && profile.role !== "org_admin") {
    throw new Error("Forbidden: only the center owner can do this.");
  }
  return requireActiveInstituteId();
}

// Every tenant collection supports soft delete (Trash): rows carry `deletedAt`,
// normal reads filter it out, and anything deleted can be restored or purged.
// Items stay in Trash until the owner acts — there is no automatic expiry.
const SOFT_DELETE = new Set<CollectionName>(Object.keys(CONFIG) as CollectionName[]);

/** Client item → DB insert/update values. */
function toDb(collection: CollectionName, item: Record<string, unknown>): Record<string, unknown> {
  const cfg = CONFIG[collection];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    const key = cfg.rename[k] ?? k;
    // Server-owned columns are never writable from a patch. `instituteId` is
    // the important one: updateRow's WHERE clause stops a caller touching
    // another tenant's row, but without this a crafted patch could set
    // instituteId and PUSH one of their own rows into someone else's center —
    // injecting fake students or fees into a stranger's books. deletedAt is
    // stripped too so Trash can only be driven through softDeleteRow /
    // restoreRow, which is where the semantics live.
    if (STRIP.has(key)) continue;
    out[key] = v;
  }
  // Only normalise fields the caller actually sent: a PARTIAL patch (e.g.
  // updating just `welcomeKit`) must never touch absent columns — turning
  // "absent" into NULL here once wiped dob/course/batch on every student a
  // partial update touched.
  for (const f of cfg.nullEmpty) {
    if (f in out && (out[f] === "" || out[f] === undefined)) out[f] = null;
  }
  return out;
}

/** DB row → client item (strip internals, null → "", rename back). */
function fromDb(collection: CollectionName, row: Record<string, unknown>): Record<string, unknown> {
  const cfg = CONFIG[collection];
  const reverse: Record<string, string> = {};
  for (const [clientKey, dbKey] of Object.entries(cfg.rename)) reverse[dbKey] = clientKey;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP.has(k)) continue;
    const key = reverse[k] ?? k;
    out[key] = v === null ? "" : v;
  }
  return out;
}

/* ── Reads ───────────────────────────────────────────────────────── */

/** Load every collection for the active institute (one call hydrates the UI). */
export async function fetchDb(): Promise<Db> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return EMPTY_DB;

  const result: Record<string, unknown[]> = {};
  await Promise.all(
    (Object.keys(CONFIG) as CollectionName[]).map(async (name) => {
      try {
        const t = CONFIG[name].table;
        const where = SOFT_DELETE.has(name)
          ? and(eq(t.instituteId, instituteId), isNull(t.deletedAt))
          : eq(t.instituteId, instituteId);
        // Stable order: newest first, consistent on every page and every load.
        // Without an ORDER BY, Postgres returns rows in arbitrary order that
        // reshuffles whenever a row is updated — lists then look "out of sync"
        // between pages (Students vs ID Cards) from one load to the next.
        const rows = await db.select().from(t).where(where).orderBy(desc(t.createdAt));
        result[name] = rows.map((r: Record<string, unknown>) => fromDb(name, r));
      } catch (err) {
        // One collection failing (e.g. a pending migration) must never blank the
        // whole app — fall back to empty for just that collection.
        console.error(`[fetchDb] failed to load "${name}":`, err);
        result[name] = [];
      }
    }),
  );

  // ── Scale warning ────────────────────────────────────────────────
  // This function has no LIMIT: it loads every row of all 18 collections for
  // the tenant on every hydrate, and list "pagination" is a client-side slice
  // of what is already in memory. That is fine for a small center and will not
  // hold at the 1,000 students the Business plan advertises — one year of
  // attendance alone is ~250k rows.
  //
  // Fixing it properly means moving aggregation server-side per view. Until
  // then, log when a center crosses a size where that work becomes urgent, so
  // the wall arrives as a warning in the logs rather than as a customer whose
  // dashboard stopped loading. Windowing by date here would be worse than the
  // problem: the financial report has a full-year scope, and silently
  // truncating money data is not an acceptable trade for speed.
  const totalRows = Object.values(result).reduce((n, rows) => n + rows.length, 0);
  if (totalRows > 50_000) {
    console.warn(
      `[fetchDb] institute ${instituteId} hydrated ${totalRows} rows in one payload. ` +
        `Server-side pagination is needed before this center grows further.`,
    );
  }

  // Profile is resilient too: if it fails (e.g. a pending migration), fall back
  // to an empty profile rather than blanking the whole app.
  let profile: Profile;
  try {
    profile = await loadProfile(instituteId);
  } catch (err) {
    console.error("[fetchDb] failed to load profile:", err);
    profile = EMPTY_PROFILE;
  }

  return { ...(result as unknown as Omit<Db, "profile">), profile };
}

/**
 * Load a center's profile. NOT exported — everything in this file is a server
 * action, and an action that takes an institute id as an argument is callable
 * with ANY id by any signed-in user. That leaked every center's owner name,
 * phone, GST, address and UPI ID. Callers must resolve the tenant themselves
 * and pass a verified id.
 */
async function loadProfile(instituteId: string): Promise<Profile> {
  const inst = await db.query.institutes.findFirst({ where: eq(institutes.id, instituteId) });
  if (!inst) return EMPTY_PROFILE;

  return {
    businessName: inst.name ?? "",
    businessType: inst.type ?? "abacus",
    ownerName: inst.ownerName ?? "",
    email: inst.email ?? "",
    phone: inst.phone ?? "",
    gst: inst.gst ?? "",
    city: inst.city ?? "",
    address: inst.address ?? "",
    monthlyFee: inst.monthlyFee ?? 0,
    admissionFee: inst.admissionFee ?? 0,
    reactivationFee: inst.reactivationFee ?? 0,
    hoRoyaltyPerStudent: inst.hoRoyaltyPerStudent ?? 0,
    hoRoyaltyPercent: inst.hoRoyaltyPercent ?? 0,
    recurringCharges: inst.recurringCharges ?? [],
    website: inst.website ?? "",
    extraLink: inst.extraLink ?? "",
    upiId: inst.upiId ?? "",
    qrImage: inst.qrImageUrl ?? "",
    avatar: inst.avatarUrl ?? "",
    facebook: inst.facebook ?? "",
    instagram: inst.instagram ?? "",
    youtube: inst.youtube ?? "",
    whatsapp: inst.whatsapp ?? "",
    certImage: inst.certImageUrl ?? "",
    certLayout: inst.certLayout ?? DEFAULT_CERT_LAYOUT,
    idCardDesign: inst.idCardDesign ?? DEFAULT_ID_CARD_DESIGN,
  };
}

/** The ACTIVE institute's profile. Takes no arguments by design — see loadProfile. */
export async function fetchProfile(): Promise<Profile> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return EMPTY_PROFILE;
  return loadProfile(instituteId);
}

/* ── Writes ──────────────────────────────────────────────────────── */

export async function createRow(collection: CollectionName, item: Record<string, unknown>): Promise<void> {
  const instituteId = await requireWriteAccess(collection);
  // Student capacity is prepaid and enforced here — the one write path every
  // add and every bulk import goes through, so it cannot be bypassed from the
  // client. The UI checks first (see checkStudentCapacityAction) to show a
  // helpful dialog; this is the backstop.
  if (collection === "students") {
    const check = await checkStudentCapacity(instituteId, 1);
    if (!check.ok) throw new Error(check.reason);
  }
  await db.insert(CONFIG[collection].table).values({ ...toDb(collection, item), instituteId });
}

/** Student usage + capacity for the active center (for meters and warnings). */
export async function getStudentUsageAction(): Promise<StudentUsage | null> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return null;
  return getStudentUsage(instituteId);
}

/**
 * Pre-flight capacity check for the active center. The UI calls this before
 * adding one student or importing a batch, so the owner gets a clear dialog
 * instead of a silently reverted optimistic write.
 */
export async function checkStudentCapacityAction(
  wanted = 1,
): Promise<{ ok: boolean; reason?: string; usage: StudentUsage | null }> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return { ok: true, usage: null };
  const check = await checkStudentCapacity(instituteId, wanted);
  return check.ok
    ? { ok: true, usage: check.usage }
    : { ok: false, reason: check.reason, usage: check.usage };
}

export async function updateRow(collection: CollectionName, id: string, patch: Record<string, unknown>): Promise<void> {
  const instituteId = await requireWriteAccess(collection);
  const table = CONFIG[collection].table;
  const values = toDb(collection, patch);
  delete values.id;
  await db.update(table).set({ ...values, updatedAt: new Date() }).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

export async function deleteRow(collection: CollectionName, id: string): Promise<void> {
  const instituteId = await requireWriteAccess(collection);
  const table = CONFIG[collection].table;
  await db.delete(table).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

/* ── Soft delete / Trash (core entities only) ────────────────────── */

/** Move a row to Trash (recoverable). Falls back to a hard delete for
 *  collections that don't support soft delete. */
export async function softDeleteRow(collection: CollectionName, id: string): Promise<void> {
  if (!SOFT_DELETE.has(collection)) return deleteRow(collection, id);
  const instituteId = await requireWriteAccess(collection);
  const table = CONFIG[collection].table;
  await db.update(table).set({ deletedAt: new Date() }).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

/** Restore a trashed row (clear its deletedAt). */
export async function restoreRow(collection: CollectionName, id: string): Promise<void> {
  if (!SOFT_DELETE.has(collection)) return;
  const instituteId = await requireWriteAccess(collection);
  const table = CONFIG[collection].table;
  await db.update(table).set({ deletedAt: null }).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

export type TrashItem = { collection: CollectionName; id: string; label: string; amount: number; deletedAt: string };

// A human label for any collection's row, from whatever common fields it has.
function trashLabel(collection: CollectionName, r: Record<string, unknown>): string {
  const s = (k: string) => String(r[k] ?? "").trim();
  const person = s("firstName") ? `${s("firstName")} ${s("lastName")}`.trim() : "";
  const primary = person || s("name") || s("title") || s("item") || s("studentName");
  let detail = "";
  if (s("studentName") && primary !== s("studentName")) detail = ` — ${s("studentName")}`;
  else if (s("category")) detail = ` · ${s("category")}`;
  else if (s("code")) detail = ` (${s("code")})`;
  else if (s("date")) detail = ` · ${s("date")}`;
  return (primary + detail).trim() || collection;
}

/** Everything currently in Trash for the active institute. Items stay here until
 *  the owner restores or permanently deletes them — nothing is auto-removed. */
export async function fetchTrash(): Promise<TrashItem[]> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return [];

  const out: TrashItem[] = [];
  await Promise.all(
    Array.from(SOFT_DELETE).map(async (name) => {
      const t = CONFIG[name].table;
      try {
        const rows = await db.select().from(t).where(and(eq(t.instituteId, instituteId), isNotNull(t.deletedAt)));
        for (const raw of rows as Record<string, unknown>[]) {
          const item = fromDb(name, raw);
          const deletedAt = raw.deletedAt instanceof Date ? raw.deletedAt.toISOString() : String(raw.deletedAt);
          out.push({
            collection: name, id: String(item.id), label: trashLabel(name, item),
            amount: typeof item.amount === "number" ? item.amount : 0, deletedAt,
          });
        }
      } catch (err) {
        console.error(`[fetchTrash] failed for "${name}":`, err);
      }
    }),
  );
  // Most-recently trashed first.
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// Partial: any derived/read-only Profile field without a column is omitted here —
// saveProfile skips any key that has no mapping.
const PROFILE_MAP: Partial<Record<keyof Profile, string>> = {
  businessName: "name", businessType: "type", ownerName: "ownerName", email: "email",
  phone: "phone", gst: "gst", city: "city", address: "address", monthlyFee: "monthlyFee",
  admissionFee: "admissionFee", reactivationFee: "reactivationFee", hoRoyaltyPerStudent: "hoRoyaltyPerStudent", hoRoyaltyPercent: "hoRoyaltyPercent", recurringCharges: "recurringCharges", website: "website", extraLink: "extraLink", upiId: "upiId", qrImage: "qrImageUrl",
  avatar: "avatarUrl", facebook: "facebook", instagram: "instagram", youtube: "youtube",
  whatsapp: "whatsapp", certImage: "certImageUrl", certLayout: "certLayout",
  idCardDesign: "idCardDesign",
};

/** Save the active institute's profile. Marks the center as onboarded. */
export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  // Owner-only: this writes upiId and qrImageUrl. A teacher who could reach it
  // would be able to redirect every fee payment to their own UPI ID.
  const instituteId = await requireOwner();
  const values: Record<string, unknown> = { updatedAt: new Date(), onboarded: true };
  for (const [k, v] of Object.entries(patch)) {
    const col = PROFILE_MAP[k as keyof Profile];
    if (col) values[col] = v;
  }
  // Was this the save that completes onboarding? The dashboard layout caches
  // `needsOnboarding` as an RSC prop, so without a revalidate the onboarding
  // gate keeps bouncing the owner back to /profile for the rest of the session
  // even though the DB already says they're done.
  const [before] = await db
    .select({ onboarded: institutes.onboarded })
    .from(institutes)
    .where(eq(institutes.id, instituteId))
    .limit(1);

  await db.update(institutes).set(values).where(eq(institutes.id, instituteId));

  if (before && before.onboarded === false) revalidatePath("/", "layout");
}

/** Delete ALL of the active institute's records (keeps the institute + profile). */
export async function clearInstituteData(): Promise<void> {
  // Owner-only, and a HARD delete that Trash cannot undo.
  const instituteId = await requireOwner();
  await Promise.all(
    (Object.keys(CONFIG) as CollectionName[]).map((name) =>
      db.delete(CONFIG[name].table).where(eq(CONFIG[name].table.instituteId, instituteId)),
    ),
  );
}
