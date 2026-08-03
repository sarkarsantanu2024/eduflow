/**
 * One-time platform seed: subscription plans + the platform super-admin.
 *
 * It does NOT create any customer institute — those are created via the
 * /register flow (each picks its sector) or by the super-admin console.
 *
 * Run with:
 *   npx tsx --env-file=.env.local src/lib/db/seed.ts
 *
 * Override the super-admin via env (recommended — set a strong password):
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const { subscriptionPlans, users } = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (use --env-file=.env.local)");

  const db = drizzle(neon(url), { schema, casing: "snake_case" });

  // ── 1) Subscription plans (global) ─────────────────────────────────
  // Full lineup — keep in sync with SUBSCRIPTION_PLANS in src/lib/constants.ts.
  // whatsappQuota stays 0 on every tier: click-to-send goes from the owner's own
  // number, so it is free and unlimited. Quotas would only apply if/when the
  // Meta Cloud API auto-send ships (Enterprise).
  const plans: Array<typeof subscriptionPlans.$inferInsert> = [
    { code: "free", name: "Free", priceMonthly: 0, maxStudents: 15, maxStaff: 1, whatsappQuota: 0, sortOrder: 0,
      features: { bulk_import: true, watermark: true } },
    { code: "starter", name: "Starter", priceMonthly: 499, maxStudents: 75, maxStaff: 1, whatsappQuota: 0, sortOrder: 1,
      features: { launch_offer: true, reports: true, bulk_import: true, tests: true, exam_boards: true, certificates: true, expenses: true } },
    { code: "growth", name: "Growth", priceMonthly: 999, maxStudents: 200, maxStaff: 3, whatsappQuota: 0, sortOrder: 2,
      features: { launch_offer: true, reports: true, bulk_import: true, tests: true, exam_boards: true, certificates: true, expenses: true, posters: true, periodic_reports: true } },
    { code: "business", name: "Business", priceMonthly: 1999, maxStudents: 500, maxStaff: 10, whatsappQuota: 0, sortOrder: 3,
      features: { launch_offer: true, reports: true, bulk_import: true, tests: true, exam_boards: true, certificates: true, expenses: true, posters: true, periodic_reports: true, videos: true, advanced_reports: true, custom_branding: true, priority_support: true, multi_activity: true } },
    { code: "enterprise", name: "Enterprise", priceMonthly: 0, maxStudents: null, maxStaff: null, whatsappQuota: 0, sortOrder: 4,
      features: { custom_pricing: true, account_manager: true, priority_onboarding: true, unlimited_staff: true } },
  ];
  for (const p of plans) {
    // Upsert by code so re-running updates prices/caps for the whole lineup.
    await db.insert(subscriptionPlans).values(p).onConflictDoUpdate({
      target: subscriptionPlans.code,
      set: { name: p.name, priceMonthly: p.priceMonthly, maxStudents: p.maxStudents, maxStaff: p.maxStaff, whatsappQuota: p.whatsappQuota, sortOrder: p.sortOrder, features: p.features, isActive: true },
    });
  }
  // Retire the codes from earlier lineups. Existing subscriptions keep working
  // (see PLAN_RANK legacy entries in src/lib/plan-gating.ts) — the plans simply
  // stop being offered to new centers.
  await db.update(subscriptionPlans).set({ isActive: false })
    .where(inArray(subscriptionPlans.code, ["professional", "pro", "premium"]));
  console.log(`✓ ${plans.length} subscription plans ensured`);

  // ── 2) Platform super-admin ────────────────────────────────────────
  const saEmail = (process.env.SUPERADMIN_EMAIL ?? "sarkarsantanu69@gmail.com").toLowerCase();
  const saUsername = (process.env.SUPERADMIN_USERNAME ?? "superadmin").toLowerCase();
  const saPassword = process.env.SUPERADMIN_PASSWORD ?? "changeme-super-admin";
  const existingSa = await db.query.users.findFirst({ where: eq(users.email, saEmail) });
  if (!existingSa) {
    await db.insert(users).values({
      username: saUsername,
      email: saEmail,
      passwordHash: await bcrypt.hash(saPassword, 10),
      fullName: "Platform Admin",
      role: "super_admin",
      instituteId: null,
    });
    console.log(`✓ super-admin created: ${saUsername} (${saEmail}) / ${saPassword}`);
  } else {
    // Re-sync the password (and role) so re-running the seed resets it.
    await db.update(users)
      .set({ passwordHash: await bcrypt.hash(saPassword, 10), role: "super_admin", isActive: true })
      .where(eq(users.id, existingSa.id));
    console.log(`✓ super-admin password reset: ${saEmail} / ${saPassword}`);
  }

  console.log("\nSeed complete. Create institutes via /register or the super-admin console.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
