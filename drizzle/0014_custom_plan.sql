-- ============================================================================
-- 0014_custom_plan.sql  —  Per-center custom plan (admin-set amount + capacity)
--
-- NON-DESTRUCTIVE: adds two nullable columns. Apply with:
--
--   psql "$DATABASE_URL" -f drizzle/0014_custom_plan.sql
--
-- WHY
--   The published lineup (Free → Enterprise) is priced in fixed steps. Some
--   centers are negotiated one-off — a school on 2,400 students at a figure
--   agreed on a call. Until now the only way to record that was to park them on
--   a bigger tier and pile on seat packs, which made both the cap and the MRR
--   wrong.
--
--   custom_price_monthly   What THIS center pays per month, in rupees.
--   custom_max_students    Student cap for THIS center.
--
--   Set together by a super-admin, from the plan dialog in the platform
--   console. When they are set they ALWAYS OVERRIDE the selected subscription
--   plan's price and cap; when they are NULL the selected plan applies exactly
--   as before. Either way the center keeps the modules of the plan it sits on,
--   and seat packs still add on top of the cap.
--
-- Existing rows keep working untouched: both columns default to NULL, which
-- means "the plan decides", i.e. today's behaviour.
-- ============================================================================

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "custom_price_monthly" integer;

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "custom_max_students" integer;
