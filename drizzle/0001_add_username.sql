-- Add the login identity column. Existing rows are backfilled from their
-- email so current accounts keep working (they can sign in with that value),
-- then the column is made NOT NULL + UNIQUE.
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "users" SET "username" = lower("email") WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
