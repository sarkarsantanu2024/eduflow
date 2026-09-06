-- Billing idempotency.
--
-- Monthly fees and auto-posted expenses used to be created by useEffect hooks
-- on the Fees page, deduped against the browser's own cached copy of the data.
-- Two tabs open at once meant two real charges against the same parent, and a
-- month in which nobody opened that page produced no fees at all.
--
-- Generation now runs server-side (src/features/automation/billing.ts). These
-- indexes are what make it *impossible* rather than merely unlikely to double
-- charge, even if a cron run and a page load collide.
--
-- Hand-written rather than drizzle-kit generated: the drizzle snapshot in this
-- repo is stale (0009 and 0010 were hand-written too), so `generate` re-emits
-- already-applied objects. scripts/migrate.mjs applies drizzle/*.sql in
-- filename order exactly once and ignores the journal — the .sql files are the
-- source of truth. See drizzle/README.md.

-- ── 1. Clean up duplicates the old client-side generator already created ──
-- Must run BEFORE the unique index, or the index creation fails on any center
-- that ever had two tabs open.
--
-- Keeps the row a parent actually paid against (highest amount_paid), then the
-- earliest created. The rest are SOFT-deleted, so they surface in Trash for the
-- owner to review rather than vanishing — no money record is destroyed here.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY institute_id, student_id, period
      ORDER BY amount_paid DESC, created_at ASC, id ASC
    ) AS rn
  FROM fees
  WHERE kind = 'monthly'
    AND deleted_at IS NULL
    AND student_id IS NOT NULL
)
UPDATE fees f
SET deleted_at = now()
FROM ranked r
WHERE f.id = r.id
  AND r.rn > 1;
--> statement-breakpoint

-- ── 2. One monthly fee per student per period ──
-- Partial on purpose: "other" fees all share period '' and must stay
-- unconstrained, and a trashed fee must be re-creatable.
CREATE UNIQUE INDEX IF NOT EXISTS "fees_monthly_unique"
  ON "fees" ("institute_id", "student_id", "period")
  WHERE "kind" = 'monthly' AND "deleted_at" IS NULL;
--> statement-breakpoint

-- ── 3. Dedupe key for auto-posted expenses ──
-- NULL for anything the owner types by hand, which stays freely duplicable —
-- two ₹100 tea expenses on the same day are legitimate. Set only on recurring
-- charges and the monthly teacher-salary row.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "expenses_auto_unique"
  ON "expenses" ("institute_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL AND "deleted_at" IS NULL;
