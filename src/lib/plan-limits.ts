import "server-only";
import { and, eq, isNull, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { students, subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { SUBSCRIPTION_PLANS, SEAT_PACKS } from "@/lib/constants";

/**
 * Student capacity — the one thing every plan is priced on.
 *
 * POLICY: capacity is PREPAID. A center cannot add a student beyond its
 * effective cap until the extra seats have been paid for. Enforced server-side
 * in `createRow` (the single write path every add and every bulk import goes
 * through), so it cannot be bypassed from the client.
 *
 * Effective cap = plan.maxStudents + subscription.extraStudents
 *   - plan.maxStudents = null means unlimited (Enterprise).
 *   - extraStudents is raised by a super-admin once payment lands.
 *
 * NOTHING already in the account is affected at the limit — no data is removed
 * and no feature switches off. Only the *next* admission waits.
 *
 * Trash: soft-deleted students do NOT count, so removing a student frees a seat
 * immediately.
 */

export interface StudentUsage {
  /** Active (non-trashed) students. */
  used: number;
  /** Plan cap before paid seats. null = unlimited. */
  planCap: number | null;
  /** Seats already paid for on top of the plan. */
  extra: number;
  /** planCap + extra. null = unlimited. */
  cap: number | null;
  /** Seats left. Infinity when unlimited. */
  remaining: number;
  /** 0–1 of the effective cap. 0 when unlimited. */
  ratio: number;
  atCap: boolean;
  /** True from 90% of the effective cap — where we start warning. */
  nearCap: boolean;
  planName: string;
  planCode: string;
  billingCycle: "monthly" | "annual";
}

/** A seat pack offered to the owner. Price is never rendered. */
export interface SeatPackOffer {
  seats: number;
  /** True when a plan upgrade beats this pack — we steer them there instead. */
  upgradeIsBetter: boolean;
}

export interface CapacityOffer {
  packs: SeatPackOffer[];
  /** Set when the center has outgrown seat packs entirely. */
  recommendedPlan: { code: string; name: string; students: string } | null;
  reason: string;
}

const UNLIMITED: number = Number.POSITIVE_INFINITY;

/** Current student usage and capacity for a center. */
export async function getStudentUsage(instituteId: string): Promise<StudentUsage> {
  const [countRow, subRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(students)
      .where(and(eq(students.instituteId, instituteId), isNull(students.deletedAt))),
    db
      .select({
        maxStudents: subscriptionPlans.maxStudents,
        planName: subscriptionPlans.name,
        planCode: subscriptionPlans.code,
        extraStudents: subscriptions.extraStudents,
        billingCycle: subscriptions.billingCycle,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.instituteId, instituteId))
      .limit(1),
  ]);

  const used = countRow[0]?.n ?? 0;
  const sub = subRow[0];

  // No subscription row → treat as unlimited rather than locking a center out
  // of its own data because of a provisioning gap.
  const planCap = sub ? sub.maxStudents : null;
  const extra = sub?.extraStudents ?? 0;
  const cap = planCap === null ? null : planCap + extra;

  return {
    used,
    planCap,
    extra,
    cap,
    remaining: cap === null ? UNLIMITED : Math.max(0, cap - used),
    ratio: cap === null || cap === 0 ? 0 : used / cap,
    atCap: cap !== null && used >= cap,
    nearCap: cap !== null && cap > 0 && used / cap >= 0.9,
    planName: sub?.planName ?? "Free",
    planCode: sub?.planCode ?? "free",
    billingCycle: sub?.billingCycle === "annual" ? "annual" : "monthly",
  };
}

/** Can this center add `wanted` more students? */
export async function checkStudentCapacity(
  instituteId: string,
  wanted = 1,
): Promise<{ ok: true; usage: StudentUsage } | { ok: false; usage: StudentUsage; reason: string }> {
  const usage = await getStudentUsage(instituteId);
  if (usage.cap === null || usage.remaining >= wanted) return { ok: true, usage };
  return { ok: false, usage, reason: capacityMessage(usage, wanted) };
}

/** Plain-language reason, used by both the pre-flight check and the guard. */
export function capacityMessage(usage: StudentUsage, wanted: number): string {
  const { used, cap, planName, remaining } = usage;
  if (wanted <= 1) {
    return `Your ${planName} plan supports ${cap} active students and you have ${used}. Add more student seats to continue — your existing students and data are completely safe.`;
  }
  return `You're adding ${wanted} students but only ${remaining} seat${remaining === 1 ? "" : "s"} remain on your ${planName} plan (${used} of ${cap} used). Add more student seats and import again — nothing already in your account is affected.`;
}

/**
 * Which seat packs to offer, and when to stop offering them.
 *
 * We deliberately do NOT sell seats forever. Once the plan price plus the pack
 * costs as much as the next plan up — or the center would exceed what the next
 * plan covers anyway — the honest answer is "upgrade", and it protects revenue
 * too. A Starter center at 250 students should be on Growth, not carrying six
 * seat packs.
 */
export function getCapacityOffer(usage: StudentUsage): CapacityOffer {
  const order = SUBSCRIPTION_PLANS.map((p) => p.code) as readonly string[];
  const idx = order.indexOf(usage.planCode);
  const current = SUBSCRIPTION_PLANS.find((p) => p.code === usage.planCode);
  // The next paid plan that actually holds more students than we do now.
  const next = SUBSCRIPTION_PLANS.slice(idx + 1).find(
    (p) => p.code !== "enterprise" && (p.maxStudents === null || p.maxStudents > (usage.cap ?? 0)),
  );

  // Unlimited, or nothing above us: seat packs are all we have.
  if (!current || !next) {
    return {
      packs: SEAT_PACKS.map((p) => ({ seats: p.seats, upgradeIsBetter: false })),
      recommendedPlan: null,
      reason: "",
    };
  }

  const currentMonthly = current.price;
  const extraCost = (seats: number) =>
    SEAT_PACKS.find((p) => p.seats === seats)?.price ?? 0;
  // What they already pay for seats bought earlier, at pack rates.
  const alreadyPaidForSeats = usage.extra > 0 ? estimateSeatSpend(usage.extra) : 0;

  const packs = SEAT_PACKS.map((p) => {
    const wouldPay = currentMonthly + alreadyPaidForSeats + extraCost(p.seats);
    const wouldHold = (usage.cap ?? 0) + p.seats;
    const overshoots = next.maxStudents !== null && wouldHold > next.maxStudents;
    return { seats: p.seats, upgradeIsBetter: wouldPay >= next.price || overshoots };
  });

  const allWorseThanUpgrade = packs.every((p) => p.upgradeIsBetter);
  return {
    packs,
    recommendedPlan: allWorseThanUpgrade
      ? { code: next.code, name: next.name, students: next.students }
      : null,
    reason: allWorseThanUpgrade
      ? `You're using ${usage.used} students. Moving to ${next.name} costs less than buying more seats and includes more features.`
      : "",
  };
}

/** Roughly what a center's existing extra seats cost, at pack rates. */
function estimateSeatSpend(seats: number): number {
  let left = seats;
  let total = 0;
  // Biggest packs first — how they'd actually have been sold.
  for (const pack of [...SEAT_PACKS].sort((a, b) => b.seats - a.seats)) {
    while (left >= pack.seats) {
      total += pack.price;
      left -= pack.seats;
    }
  }
  if (left > 0) total += SEAT_PACKS[0].price; // part pack rounds up to the smallest
  return total;
}

/**
 * The WhatsApp message a center sends when it wants more seats. Pre-filled with
 * everything we need to quote and apply the capacity without a back-and-forth.
 */
export function seatRequestMessage(params: {
  instituteName: string;
  centerId: string;
  usage: StudentUsage;
  seats: number;
}): string {
  const { instituteName, centerId, usage, seats } = params;
  return [
    "Hi EduFlow Team,",
    "",
    `Institute: ${instituteName || "—"}`,
    `Center ID: ${centerId}`,
    `Current Plan: ${usage.planName}`,
    `Current Limit: ${usage.cap === null ? "Unlimited" : `${usage.cap} Students`}`,
    `Current Active Students: ${usage.used}`,
    "",
    `I would like to purchase ${seats} additional student seats.`,
  ].join("\n");
}

/** Short, human center reference used in the WhatsApp message. */
export function centerRef(instituteId: string): string {
  return `EDU-${instituteId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
