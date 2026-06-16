import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append an entry to the tenant audit trail. Uses the service role so a log
 * write never fails on RLS. Fire-and-forget: logging must not break the
 * primary operation.
 */
export async function logActivity(params: {
  instituteId: string | null;
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("activity_logs").insert({
      institute_id: params.instituteId,
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("[activity] failed to log", params.action, err);
  }
}
