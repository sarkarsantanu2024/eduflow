-- ============================================================================
-- 0004_leads.sql  —  Lead capture from the public marketing site (additive)
--
-- NON-DESTRUCTIVE: adds one new table. Nothing existing changes. Apply with:
--
--   psql "$DATABASE_URL" -f drizzle/0004_leads.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- The "Book your free demo" form on marketing-site/index.html POSTs to
-- /api/leads, which writes here. Only the super-admin can read it
-- (/admin/leads). It is the sales pipeline — not tenant data — so the table is
-- global and has no institute_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "leads" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"        text NOT NULL,
  "center_name" text DEFAULT '' NOT NULL,
  "center_type" text DEFAULT '' NOT NULL,
  "students"    integer,
  "phone"       text NOT NULL,
  "email"       text,
  "city"        text,
  "message"     text DEFAULT '' NOT NULL,
  "source"      text DEFAULT 'website' NOT NULL,
  "status"      text DEFAULT 'new' NOT NULL,
  "notes"       text DEFAULT '' NOT NULL,
  "deleted_at"  timestamp with time zone,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "leads_created_idx" ON "leads" ("created_at");
