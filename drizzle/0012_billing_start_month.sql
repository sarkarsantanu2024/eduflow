-- When monthly billing begins for a student.
--
-- The admission form assumed "admitted today". That is true for a walk-in and
-- false for the far more common first week of use, where an owner types in
-- every student who has been coming for months. Those students were given an
-- admission fee due on their real admission date — so a student admitted in
-- January appeared eight months overdue the moment they were entered — and
-- were billed for the current month on the day of entry.
--
-- The real admission date has to stay on the record (it prints on the ID card
-- and is what the owner recognises). So the billing start is tracked
-- separately: empty means "bill from the admission month", which keeps every
-- existing row behaving exactly as before.

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "billing_start_month" text NOT NULL DEFAULT '';
