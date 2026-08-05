-- ============================================================================
-- 0008_ad_materials_stationery_royalty.sql
--
-- BACKFILL MIGRATION. These objects already exist in the production database —
-- they were applied by hand and never captured as a migration file, so a fresh
-- environment built from drizzle/ alone would have been missing them while
-- src/lib/db/schema.ts referenced them (institutes.recurringCharges, the
-- adMaterials and stationery tables). This file closes that gap.
--
-- NON-DESTRUCTIVE and idempotent: every statement is IF NOT EXISTS, so it is a
-- no-op on any database where the hand-applied SQL already ran.
--
--   institutes.ho_royalty_per_student / ho_royalty_percent
--     Legacy head-office royalty fields. Superseded by recurring_charges — the
--     percent value is folded into a generic recurring charge on first load
--     (see src/features/fees/fees-view.tsx) — but kept so that migration can
--     still find the old value.
--
--   institutes.recurring_charges
--     Monthly charges the center pays: fixed ₹, per active student, or % of the
--     month's fees. Auto-posted to expenses each month so net profit is real.
--
--   ad_materials / stationery
--     The physical marketing stock and stationery a center receives or prints,
--     logged per batch. Surfaced on the "Ad & Stationery" page.
-- ============================================================================

ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "ho_royalty_per_student" integer NOT NULL DEFAULT 0;
ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "ho_royalty_percent"     integer NOT NULL DEFAULT 0;
ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "recurring_charges"      jsonb   NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "ad_materials" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
  "date"         date,
  "banner"       integer NOT NULL DEFAULT 0,
  "leaflet"      integer NOT NULL DEFAULT 0,
  "sun_pack"     integer NOT NULL DEFAULT 0,
  "poster"       integer NOT NULL DEFAULT 0,
  "voice"        integer NOT NULL DEFAULT 0,
  "other"        text NOT NULL DEFAULT '',
  "added_by"     text NOT NULL DEFAULT '',
  "deleted_at"   timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ad_materials_institute_idx" ON "ad_materials" ("institute_id");

CREATE TABLE IF NOT EXISTS "stationery" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
  "date"         date,
  "stationery"   integer NOT NULL DEFAULT 0,
  "gift"         integer NOT NULL DEFAULT 0,
  "other"        text NOT NULL DEFAULT '',
  "added_by"     text NOT NULL DEFAULT '',
  "deleted_at"   timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stationery_institute_idx" ON "stationery" ("institute_id");
