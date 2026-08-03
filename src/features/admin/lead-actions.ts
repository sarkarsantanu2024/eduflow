"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, isNull, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { LEAD_STATUSES, type LeadStatus, type LeadRow } from "@/lib/leads";

/**
 * Sales pipeline — enquiries captured by the public marketing-site form
 * (POST /api/leads). Super-admin only; this is not tenant data.
 */

/**
 * True when the query failed only because the `leads` table hasn't been created
 * yet (drizzle/0004_leads.sql not applied). Lead capture is an add-on, so a
 * missing table must never take down the whole admin console.
 */
function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /relation .*leads.* does not exist|undefined_table|42P01/i.test(msg);
}

/** Every live lead, newest first. */
export async function listLeads(): Promise<LeadRow[]> {
  await requireSuperAdmin();
  let rows: (typeof leads.$inferSelect)[];
  try {
    rows = await db
      .select()
      .from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(desc(leads.createdAt));
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    console.warn("[leads] table missing — apply drizzle/0004_leads.sql (or run `npm run db:push`)");
    return [];
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    centerName: r.centerName,
    centerType: r.centerType,
    students: r.students,
    phone: r.phone,
    email: r.email,
    city: r.city,
    message: r.message,
    source: r.source,
    status: r.status,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}

/** Counts per status, for the summary tiles. */
export async function getLeadStats(): Promise<Record<string, number>> {
  await requireSuperAdmin();
  let rows: { status: string; count: number }[];
  try {
    rows = await db
      .select({ status: leads.status, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.status);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    console.warn("[leads] table missing — apply drizzle/0004_leads.sql (or run `npm run db:push`)");
    return { total: 0 };
  }
  const out: Record<string, number> = { total: 0 };
  let total = 0;
  for (const r of rows) {
    out[r.status] = Number(r.count);
    total += Number(r.count);
  }
  out.total = total;
  return out;
}

/** Move a lead along the pipeline. */
export async function setLeadStatus(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !LEAD_STATUSES.includes(status as LeadStatus)) return;
  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, id));
  revalidatePath("/admin/leads");
}

/** Save private sales notes against a lead. */
export async function saveLeadNotes(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").slice(0, 4000);
  if (!id) return;
  await db.update(leads).set({ notes, updatedAt: new Date() }).where(eq(leads.id, id));
  revalidatePath("/admin/leads");
}

/** Soft-delete (spam, duplicates). Recoverable in the database if needed. */
export async function deleteLead(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.update(leads).set({ deletedAt: new Date() }).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  revalidatePath("/admin/leads");
}
