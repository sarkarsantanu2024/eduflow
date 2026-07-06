-- ============================================================================
-- 0002_head_office.sql  —  Multi-center / Head-Office console (additive, safe)
--
-- This migration is NON-DESTRUCTIVE: it only ADDS an enum value, a new table
-- and two nullable columns. Existing centers are unaffected (organization_id
-- stays NULL = standalone). Apply when ready:
--
--   psql "$DATABASE_URL" -f drizzle/0002_head_office.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- The Head-Office console itself stays hidden until NEXT_PUBLIC_FEATURE_HO=true.
-- ============================================================================

-- New role for franchise owners. ADD VALUE is append-only and idempotent.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'org_admin';

-- Organizations = franchise / multi-center brands that own several branches.
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "owner_name" text DEFAULT '' NOT NULL,
  "email" text,
  "phone" text,
  "logo_url" text,
  "partner_share_percent" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_slug_unique" UNIQUE ("slug")
);

-- Link branches and org-admin logins to an organization (NULL = standalone).
ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" uuid;

DO $$ BEGIN
  ALTER TABLE "institutes" ADD CONSTRAINT "institutes_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "institutes_organization_idx" ON "institutes" ("organization_id");
CREATE INDEX IF NOT EXISTS "users_organization_idx" ON "users" ("organization_id");
