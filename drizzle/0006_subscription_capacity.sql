-- ============================================================================
-- 0006_subscription_capacity.sql  —  Billing cycle + prepaid extra students
--
-- NON-DESTRUCTIVE: adds two columns with safe defaults. Apply with:
--
--   psql "$DATABASE_URL" -f drizzle/0006_subscription_capacity.sql
--   (or run `npm run db:push` after reviewing the generated diff)
--
-- WHY
--   Student capacity is now enforced (src/lib/plan-limits.ts). A center cannot
--   add a student past its cap until the extra capacity has been PAID FOR, on
--   monthly and annual alike — so we need to know two things the subscriptions
--   table never recorded:
--
--   billing_cycle    'monthly' | 'annual'. Annual is billed at ten months'
--                    price for twelve months of service. Needed so the app can
--                    quote the right upgrade figure (an annual upgrade is
--                    pro-rated over the months remaining, not charged in full).
--
--   extra_students   Extra student slots the center has PAID FOR on top of the
--                    plan cap, at ADD_ONS.extraStudent per slot per month.
--                    Effective cap = plan.max_students + extra_students.
--                    Set by a super-admin once payment is received; there is no
--                    self-serve gateway flow yet, so this is deliberately a
--                    manual, auditable field rather than something the tenant
--                    can change.
--
-- Existing rows keep working: monthly cycle, zero extra slots.
-- ============================================================================

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "billing_cycle" text DEFAULT 'monthly' NOT NULL;

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "extra_students" integer DEFAULT 0 NOT NULL;
