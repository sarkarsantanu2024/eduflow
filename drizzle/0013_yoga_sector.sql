-- Yoga centres are one of the ten centre types the marketing site advertises,
-- but "yoga" was missing from the institute_type enum — so a yoga centre could
-- not be created at all, and the sales demo had no yoga studio to show.
--
-- ADD VALUE IF NOT EXISTS is idempotent, and cannot run inside a transaction
-- block; scripts/migrate.mjs sends each statement on its own, so that is fine.
ALTER TYPE "institute_type" ADD VALUE IF NOT EXISTS 'yoga';
