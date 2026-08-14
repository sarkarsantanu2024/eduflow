-- WhatsApp automation (Phase 1): per-center switches + queued-reminder outbox.
-- Storage-lean: unique dedupe key = a reminder is queued at most once ever;
-- dismissed rows are hard-deleted; sent rows are purged by cron after 60 days.

ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "automation" jsonb;

CREATE TABLE IF NOT EXISTS "message_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
  "student_id" uuid REFERENCES "students"("id") ON DELETE CASCADE,
  "student_name" text NOT NULL DEFAULT '',
  "phone" text NOT NULL,
  "kind" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "dedupe_key" text NOT NULL,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "message_outbox_institute_idx" ON "message_outbox" ("institute_id");
CREATE UNIQUE INDEX IF NOT EXISTS "message_outbox_dedupe" ON "message_outbox" ("institute_id", "dedupe_key");
