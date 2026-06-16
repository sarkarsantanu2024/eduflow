import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Privileged Supabase client using the SERVICE ROLE key.
 * ⚠️  BYPASSES RLS. Use only in trusted server code:
 *   - Razorpay / WhatsApp webhooks
 *   - cron jobs (reminder scheduler)
 *   - activity-log inserts
 * NEVER import from a client component.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
