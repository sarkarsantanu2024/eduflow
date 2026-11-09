import "server-only";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";

/**
 * Records who did what to whom, in `activity_logs`.
 *
 * For actions that reach into a customer's data or account from the platform
 * console: opening a centre as its owner, resetting a password, suspending or
 * deleting a centre. "Who looked at this centre's data, and when?" must always
 * have an answer.
 *
 * A failed write is logged, not thrown: an audit hiccup must not stop an admin
 * from fixing a customer's problem. Pass `instituteId: null` for an entry that
 * must outlive the centre (activity_logs cascades on institute delete).
 */
export async function audit(entry: {
  actorId: string;
  instituteId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      actorId: entry.actorId,
      instituteId: entry.instituteId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.error(`[audit] could not record ${entry.action}`, e);
  }
}
