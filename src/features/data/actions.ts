"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  institutes, students, courses, batches, templates, fees, payments, expenses,
  attendance, promotions, testScores, certificates, examRegs, performances,
  materials, events, teachers,
} from "@/lib/db/schema";
import { getActiveInstituteId, requireActiveInstituteId } from "@/lib/tenant";
import {
  EMPTY_DB, EMPTY_PROFILE, DEFAULT_CERT_LAYOUT,
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
  events: { table: events, rename: {}, nullEmpty: ["date"] },
  teachers: { table: teachers, rename: {}, nullEmpty: ["joinDate"] },
};

const STRIP = new Set(["instituteId", "createdAt", "updatedAt"]);

/** Client item → DB insert/update values. */
function toDb(collection: CollectionName, item: Record<string, unknown>): Record<string, unknown> {
  const cfg = CONFIG[collection];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    const key = cfg.rename[k] ?? k;
    out[key] = v;
  }
  for (const f of cfg.nullEmpty) {
    if (out[f] === "" || out[f] === undefined) out[f] = null;
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
      const rows = await db.select().from(CONFIG[name].table).where(eq(CONFIG[name].table.instituteId, instituteId));
      result[name] = rows.map((r: Record<string, unknown>) => fromDb(name, r));
    }),
  );

  return { ...(result as unknown as Omit<Db, "profile">), profile: await fetchProfile(instituteId) };
}

/** Load the active institute's profile (center settings). */
export async function fetchProfile(instituteIdArg?: string): Promise<Profile> {
  const instituteId = instituteIdArg ?? (await getActiveInstituteId());
  if (!instituteId) return EMPTY_PROFILE;

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
    reactivationFee: inst.reactivationFee ?? 0,
    website: inst.website ?? "",
    upiId: inst.upiId ?? "",
    qrImage: inst.qrImageUrl ?? "",
    avatar: inst.avatarUrl ?? "",
    facebook: inst.facebook ?? "",
    instagram: inst.instagram ?? "",
    youtube: inst.youtube ?? "",
    whatsapp: inst.whatsapp ?? "",
    certImage: inst.certImageUrl ?? "",
    certLayout: inst.certLayout ?? DEFAULT_CERT_LAYOUT,
  };
}

/* ── Writes ──────────────────────────────────────────────────────── */

export async function createRow(collection: CollectionName, item: Record<string, unknown>): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  await db.insert(CONFIG[collection].table).values({ ...toDb(collection, item), instituteId });
}

export async function updateRow(collection: CollectionName, id: string, patch: Record<string, unknown>): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  const table = CONFIG[collection].table;
  const values = toDb(collection, patch);
  delete values.id;
  await db.update(table).set({ ...values, updatedAt: new Date() }).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

export async function deleteRow(collection: CollectionName, id: string): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  const table = CONFIG[collection].table;
  await db.delete(table).where(and(eq(table.id, id), eq(table.instituteId, instituteId)));
}

const PROFILE_MAP: Record<keyof Profile, string> = {
  businessName: "name", businessType: "type", ownerName: "ownerName", email: "email",
  phone: "phone", gst: "gst", city: "city", address: "address", monthlyFee: "monthlyFee",
  reactivationFee: "reactivationFee", website: "website", upiId: "upiId", qrImage: "qrImageUrl",
  avatar: "avatarUrl", facebook: "facebook", instagram: "instagram", youtube: "youtube",
  whatsapp: "whatsapp", certImage: "certImageUrl", certLayout: "certLayout",
};

/** Save the active institute's profile. Marks the center as onboarded. */
export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  const values: Record<string, unknown> = { updatedAt: new Date(), onboarded: true };
  for (const [k, v] of Object.entries(patch)) {
    const col = PROFILE_MAP[k as keyof Profile];
    if (col) values[col] = v;
  }
  await db.update(institutes).set(values).where(eq(institutes.id, instituteId));
}

/** Delete ALL of the active institute's records (keeps the institute + profile). */
export async function clearInstituteData(): Promise<void> {
  const instituteId = await requireActiveInstituteId();
  await Promise.all(
    (Object.keys(CONFIG) as CollectionName[]).map((name) =>
      db.delete(CONFIG[name].table).where(eq(CONFIG[name].table.instituteId, instituteId)),
    ),
  );
}
