"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  capacityEvents, capacityRequests, institutes, students, subscriptions, subscriptionPlans,
} from "@/lib/db/schema";
import { getActiveInstituteId, requireActiveInstituteId } from "@/lib/tenant";
import { requireProfile } from "@/lib/auth";
import {
  getStudentUsage, getCapacityOffer, seatRequestMessage, centerRef,
  type StudentUsage, type CapacityOffer,
} from "@/lib/plan-limits";
import { SUPPORT } from "@/lib/constants";

/* ── Owner-facing ────────────────────────────────────────────────── */

export interface CapacityPanel {
  usage: StudentUsage;
  offer: CapacityOffer;
  centerId: string;
  instituteName: string;
  /** wa.me link per pack size, pre-filled and ready to send. */
  waLinks: Record<number, string>;
}

/** Everything the seat meter and the limit screen need, in one round trip. */
export async function getCapacityPanel(): Promise<CapacityPanel | null> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return null;

  const [usage, inst] = await Promise.all([
    getStudentUsage(instituteId),
    db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, instituteId)).limit(1),
  ]);

  const offer = getCapacityOffer(usage);
  const centerId = centerRef(instituteId);
  const instituteName = inst[0]?.name ?? "";

  const waLinks: Record<number, string> = {};
  for (const pack of offer.packs) {
    const text = seatRequestMessage({ instituteName, centerId, usage, seats: pack.seats });
    waLinks[pack.seats] = `https://wa.me/91${SUPPORT.whatsapp}?text=${encodeURIComponent(text)}`;
  }

  return { usage, offer, centerId, instituteName, waLinks };
}

/**
 * Log a seat request so it lands in the admin queue, not just a chat thread.
 * Called as the owner taps a pack; the UI opens WhatsApp regardless of whether
 * this succeeds, because getting them to us matters more than the bookkeeping.
 */
export async function requestSeats(seats: number): Promise<{ ok: boolean }> {
  const instituteId = await requireActiveInstituteId();
  const usage = await getStudentUsage(instituteId);
  const offer = getCapacityOffer(usage);

  // Don't stack duplicate pending rows if they tap twice.
  const [open] = await db
    .select({ id: capacityRequests.id })
    .from(capacityRequests)
    .where(and(eq(capacityRequests.instituteId, instituteId), eq(capacityRequests.status, "pending")))
    .limit(1);

  if (open) {
    await db.update(capacityRequests)
      .set({ seats, activeStudents: usage.used, capAtRequest: usage.cap ?? 0, updatedAt: new Date() })
      .where(eq(capacityRequests.id, open.id));
    return { ok: true };
  }

  await db.insert(capacityRequests).values({
    instituteId,
    seats,
    planCode: usage.planCode,
    planName: usage.planName,
    activeStudents: usage.used,
    capAtRequest: usage.cap ?? 0,
    suggestedPlanCode: offer.recommendedPlan?.code ?? "",
  });
  revalidatePath("/admin/capacity");
  return { ok: true };
}

/** Capacity history for the signed-in center (owner-visible). */
export async function listMyCapacityHistory(): Promise<CapacityEventRow[]> {
  const instituteId = await getActiveInstituteId();
  if (!instituteId) return [];
  return readEvents(instituteId);
}

/* ── Super-admin ─────────────────────────────────────────────────── */

async function requireSuperAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") throw new Error("Forbidden");
  return profile;
}

export interface CapacityRequestRow {
  id: string;
  instituteId: string;
  centerName: string;
  centerId: string;
  seats: number;
  status: string;
  planName: string;
  activeStudents: number;
  capAtRequest: number;
  suggestedPlanCode: string;
  notes: string;
  handledBy: string;
  createdAt: string;
}

/** The upgrade queue, newest first. */
export async function listCapacityRequests(): Promise<CapacityRequestRow[]> {
  await requireSuperAdmin();
  const rows = await db
    .select({
      id: capacityRequests.id,
      instituteId: capacityRequests.instituteId,
      centerName: institutes.name,
      seats: capacityRequests.seats,
      status: capacityRequests.status,
      planName: capacityRequests.planName,
      activeStudents: capacityRequests.activeStudents,
      capAtRequest: capacityRequests.capAtRequest,
      suggestedPlanCode: capacityRequests.suggestedPlanCode,
      notes: capacityRequests.notes,
      handledBy: capacityRequests.handledBy,
      createdAt: capacityRequests.createdAt,
    })
    .from(capacityRequests)
    .innerJoin(institutes, eq(capacityRequests.instituteId, institutes.id))
    .orderBy(desc(capacityRequests.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    centerId: centerRef(r.instituteId),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Move a request along the queue without changing capacity. */
export async function setRequestStatus(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const profile = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["pending", "payment_received", "declined"].includes(status)) return { error: "Invalid status" };

  await db.update(capacityRequests)
    .set({ status, handledBy: profile.full_name || "Admin", handledAt: new Date(), updatedAt: new Date() })
    .where(eq(capacityRequests.id, id));
  revalidatePath("/admin/capacity");
  return { ok: true };
}

/**
 * Approve a request: add the seats, write the audit row, close the request.
 * This is the only path that grants capacity from the queue, so approving and
 * recording can never drift apart.
 */
export async function approveRequest(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const profile = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const [req] = await db.select().from(capacityRequests).where(eq(capacityRequests.id, id)).limit(1);
  if (!req) return { error: "Request not found" };
  if (req.status === "approved") return { error: "Already approved" };

  const result = await addSeats({
    instituteId: req.instituteId,
    seats: req.seats,
    actorName: profile.full_name || "Admin",
    notes: req.notes || "Payment received",
  });
  if (result.error) return result;

  await db.update(capacityRequests)
    .set({ status: "approved", handledBy: profile.full_name || "Admin", handledAt: new Date(), updatedAt: new Date() })
    .where(eq(capacityRequests.id, id));
  revalidatePath("/admin/capacity");
  revalidatePath("/admin");
  return { ok: true };
}

/** Add (or remove, with a negative value) seats and record why. */
export async function addSeats(params: {
  instituteId: string;
  seats: number;
  actorName: string;
  notes: string;
}): Promise<{ error?: string; ok?: boolean; newCap?: number | null }> {
  const { instituteId, seats, actorName, notes } = params;
  if (!Number.isInteger(seats) || seats === 0) return { error: "Enter a number of seats" };

  const [sub] = await db
    .select({
      id: subscriptions.id,
      extraStudents: subscriptions.extraStudents,
      planCode: subscriptionPlans.code,
      maxStudents: subscriptionPlans.maxStudents,
    })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.instituteId, instituteId))
    .limit(1);
  if (!sub) return { error: "This center has no subscription yet" };

  const nextExtra = Math.max(0, sub.extraStudents + seats);
  await db.update(subscriptions)
    .set({ extraStudents: nextExtra, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  const newCap = sub.maxStudents === null ? null : sub.maxStudents + nextExtra;
  await db.insert(capacityEvents).values({
    instituteId,
    action: seats > 0 ? "seats_added" : "seats_removed",
    delta: seats,
    resultingCap: newCap,
    planCode: sub.planCode,
    actor: "admin",
    actorName,
    notes,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/capacity");
  revalidatePath("/billing");
  revalidatePath("/students");
  return { ok: true, newCap };
}

/** Form wrapper for the admin capacity editor. */
export async function adjustCapacity(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const profile = await requireSuperAdmin();
  const instituteId = String(formData.get("instituteId") ?? "");
  const seats = Number(formData.get("seats") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!instituteId) return { error: "Missing center" };
  const res = await addSeats({
    instituteId,
    seats,
    actorName: profile.full_name || "Admin",
    notes: notes || (seats > 0 ? "Seats added" : "Seats removed"),
  });
  return res.error ? { error: res.error } : { ok: true };
}

export interface CapacityEventRow {
  id: string;
  action: string;
  delta: number;
  resultingCap: number | null;
  actor: string;
  actorName: string;
  notes: string;
  createdAt: string;
}

async function readEvents(instituteId: string): Promise<CapacityEventRow[]> {
  const rows = await db
    .select()
    .from(capacityEvents)
    .where(eq(capacityEvents.instituteId, instituteId))
    .orderBy(desc(capacityEvents.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    delta: r.delta,
    resultingCap: r.resultingCap,
    actor: r.actor,
    actorName: r.actorName,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Capacity history for any center (super-admin). */
export async function listCapacityHistory(instituteId: string): Promise<CapacityEventRow[]> {
  await requireSuperAdmin();
  return readEvents(instituteId);
}

export interface CenterCapacityRow {
  instituteId: string;
  centerId: string;
  name: string;
  planName: string;
  planCap: number | null;
  extra: number;
  cap: number | null;
  used: number;
}

/**
 * Every center with its live capacity — powers the manual editor, so a center
 * that never used the request queue (paid over a phone call, say) can still
 * have its seats adjusted.
 */
export async function listCenterCapacity(): Promise<CenterCapacityRow[]> {
  await requireSuperAdmin();
  const rows = await db
    .select({
      instituteId: institutes.id,
      name: institutes.name,
      planName: subscriptionPlans.name,
      planCap: subscriptionPlans.maxStudents,
      extra: subscriptions.extraStudents,
    })
    .from(institutes)
    .innerJoin(subscriptions, eq(subscriptions.instituteId, institutes.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .orderBy(institutes.name);

  const counts = await db
    .select({ id: students.instituteId, n: count() })
    .from(students)
    .where(isNull(students.deletedAt))
    .groupBy(students.instituteId);
  const used = new Map(counts.map((c) => [c.id, Number(c.n)]));

  return rows.map((r) => ({
    instituteId: r.instituteId,
    centerId: centerRef(r.instituteId),
    name: r.name,
    planName: r.planName,
    planCap: r.planCap,
    extra: r.extra,
    cap: r.planCap === null ? null : r.planCap + r.extra,
    used: used.get(r.instituteId) ?? 0,
  }));
}

/** Count of requests still needing attention — for the admin dashboard badge. */
export async function countOpenCapacityRequests(): Promise<number> {
  await requireSuperAdmin();
  const rows = await db
    .select({ id: capacityRequests.id })
    .from(capacityRequests)
    .where(eq(capacityRequests.status, "pending"));
  const paid = await db
    .select({ id: capacityRequests.id })
    .from(capacityRequests)
    .where(eq(capacityRequests.status, "payment_received"));
  return rows.length + paid.length;
}
