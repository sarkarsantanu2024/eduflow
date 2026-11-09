import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * Fixed-window counters in Postgres, shared by every serverless instance.
 *
 * Sign-in counts FAILURES only, so a centre owner logging in ten times a day is
 * never slowed down; a password-guessing run is. Sign-up counts every attempt,
 * because each one creates a real tenant in the production database.
 */

export const LIMITS = {
  loginPerUser: { max: 10, windowMinutes: 15 },
  loginPerIp: { max: 30, windowMinutes: 15 },
  signupPerIp: { max: 5, windowMinutes: 60 },
} as const;

type Limit = { max: number; windowMinutes: number };

/*
 * FAILS OPEN. A database error here is logged and treated as "not limited":
 * centres signing in to collect fees matter more than slowing a guesser for
 * the minutes the counter table is unreachable.
 */

/** True when `key` has reached its limit inside the current window. */
export async function isLimited(key: string, limit: Limit): Promise<boolean> {
  try {
    const [row] = await db
      .select({ count: rateLimits.count })
      .from(rateLimits)
      .where(and(
        eq(rateLimits.key, key),
        gt(rateLimits.windowStart, sql`now() - make_interval(mins => ${limit.windowMinutes})`),
      ))
      .limit(1);
    return (row?.count ?? 0) >= limit.max;
  } catch (e) {
    console.error("[rate-limit] check failed; allowing", e);
    return false;
  }
}

/** Counts one event against `key`, starting a fresh window if the old one ran out. */
export async function hit(key: string, limit: Limit): Promise<void> {
  const expired = sql`${rateLimits.windowStart} <= now() - make_interval(mins => ${limit.windowMinutes})`;
  try {
    await db
      .insert(rateLimits)
      .values({ key, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
        },
      });
  } catch (e) {
    console.error("[rate-limit] count failed", e);
  }
}

/** Forgets `key` (a successful sign-in clears that username's failures). */
export async function clear(key: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(eq(rateLimits.key, key));
  } catch (e) {
    console.error("[rate-limit] clear failed", e);
  }
}

/**
 * The caller's address as Vercel reports it. Behind Vercel the first entry of
 * x-forwarded-for is set by the platform, not the client.
 */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
