-- Reconcile columns that exist in schema.ts (and in production) but were never
-- written into a migration.
--
-- Soft delete (2026-07-04, commit 835ca10) and a handful of later columns were
-- applied to the live database without a .sql file. Production is unaffected,
-- but a database built from drizzle/*.sql alone could not get past 0011, which
-- indexes fees.deleted_at. Found when the integration tests started building
-- their database from these files (src/test/pglite.ts).
--
-- Named 0010a so it sorts after 0010 and before 0011 on a fresh database. On
-- production every column already exists, so each statement is a no-op.
-- Types and defaults match schema.ts exactly.

ALTER TABLE "attendance"   ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "batches"      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "courses"      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "events"       ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "exam_regs"    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "expenses"     ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "fees"         ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "materials"    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "payments"     ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "performances" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "promotions"   ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "students"     ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "teachers"     ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "templates"    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "test_scores"  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "admission_fee" integer NOT NULL DEFAULT 0;
ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "extra_link" text;
ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "onboarded" boolean NOT NULL DEFAULT false;
ALTER TABLE "payments"   ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'fee';
ALTER TABLE "students"   ADD COLUMN IF NOT EXISTS "welcome_kit" jsonb;
