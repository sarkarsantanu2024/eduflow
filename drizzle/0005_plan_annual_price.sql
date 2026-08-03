-- ============================================================================
-- 0005_plan_annual_price.sql  —  Annual billing price per plan (additive)
--
-- NON-DESTRUCTIVE: adds one nullable-by-default column. Apply with:
--
--   psql "$DATABASE_URL" -f drizzle/0005_plan_annual_price.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- Annual billing is now a permanent part of the lineup: a center pays for 10
-- months and gets 12 (~17% off). The yearly figure is a stored price rather
-- than a computed discount so sales can quote a round number (₹3,999 rather
-- than ₹3,990) without the app having to special-case rounding.
--
-- 0 means "not sold yearly" — Free and Enterprise both use that.
-- Run src/lib/db/seed.ts afterwards to populate the new column and to pick up
-- the revised student/staff caps for the whole lineup.
-- ============================================================================

ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "price_annual" integer DEFAULT 0 NOT NULL;
