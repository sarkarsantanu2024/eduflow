-- ============================================================================
-- 0003_activity_center.sql  —  Multi-activity center business type (additive)
--
-- This migration is NON-DESTRUCTIVE: it only ADDS one enum value. Nothing
-- existing changes. Apply when ready:
--
--   psql "$DATABASE_URL" -f drizzle/0003_activity_center.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- "activity" = a full activity center running many activities under one roof
-- (abacus, computer, yoga, dance, drawing, music, karate, spoken English…).
-- Every optional module is switched on for this sector — see src/lib/sectors.ts.
-- ============================================================================

-- ADD VALUE is append-only and idempotent.
ALTER TYPE "institute_type" ADD VALUE IF NOT EXISTS 'activity';
