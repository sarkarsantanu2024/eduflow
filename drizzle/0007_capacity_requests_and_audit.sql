-- ============================================================================
-- 0007_capacity_requests_and_audit.sql  —  Seat-pack queue + capacity history
--
-- NON-DESTRUCTIVE: adds two new tables. Nothing existing changes. Apply with:
--
--   psql "$DATABASE_URL" -f drizzle/0007_capacity_requests_and_audit.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- capacity_requests
--   When a center hits its student limit it taps a seat pack (+25/+50/+100).
--   That records a request here AND opens WhatsApp pre-filled. The queue is the
--   system of record: WhatsApp threads stop working as a to-do list once you
--   have more than a handful of centers. Shown at /admin/capacity.
--   pending → payment_received → approved (capacity applied), or → declined.
--
-- capacity_events
--   Append-only history of every change to a center's effective capacity, so
--   "why do I have 250 seats?" always has an answer. Never UPDATE or DELETE
--   a row here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "capacity_requests" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institute_id"        uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
  "seats"               integer NOT NULL,
  "status"              text DEFAULT 'pending' NOT NULL,
  "plan_code"           text DEFAULT '' NOT NULL,
  "plan_name"           text DEFAULT '' NOT NULL,
  "active_students"     integer DEFAULT 0 NOT NULL,
  "cap_at_request"      integer DEFAULT 0 NOT NULL,
  "suggested_plan_code" text DEFAULT '' NOT NULL,
  "notes"               text DEFAULT '' NOT NULL,
  "handled_by"          text DEFAULT '' NOT NULL,
  "handled_at"          timestamptz,
  "created_at"          timestamptz DEFAULT now() NOT NULL,
  "updated_at"          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "capacity_requests_created_idx"   ON "capacity_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "capacity_requests_institute_idx" ON "capacity_requests" ("institute_id");

CREATE TABLE IF NOT EXISTS "capacity_events" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institute_id"  uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
  "action"        text NOT NULL,
  "delta"         integer DEFAULT 0 NOT NULL,
  "resulting_cap" integer,
  "plan_code"     text DEFAULT '' NOT NULL,
  "actor"         text DEFAULT 'admin' NOT NULL,
  "actor_name"    text DEFAULT '' NOT NULL,
  "notes"         text DEFAULT '' NOT NULL,
  "created_at"    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "capacity_events_institute_idx"
  ON "capacity_events" ("institute_id", "created_at");
