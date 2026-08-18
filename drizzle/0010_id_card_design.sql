-- Student ID cards: institute-wide card branding (header band, colours,
-- optional company-name/logo/tagline/website overrides), edited on the
-- ID Cards page. One jsonb column; null = default design.

ALTER TABLE "institutes" ADD COLUMN IF NOT EXISTS "id_card_design" jsonb;
