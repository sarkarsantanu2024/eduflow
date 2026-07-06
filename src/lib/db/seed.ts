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
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const { subscriptionPlans, users } = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (use --env-file=.env.local)");

  const db = drizzle(neon(url), { schema, casing: "snake_case" });

  // ── 1) Subscription plans (global) ─────────────────────────────────
  // Full 6-tier lineup — keep in sync with SUBSCRIPTION_PLANS in src/lib/constants.ts.
  const plans: Array<typeof subscriptionPlans.$inferInsert> = [
    { code: "starter", name: "Starter", priceMonthly: 499, maxStudents: 50, maxStaff: 1, whatsappQuota: 0, sortOrder: 1,
      features: { reports: true, bulk_import: true, parent_portal: false } },
    { code: "growth", name: "Growth", priceMonthly: 999, maxStudents: 100, maxStaff: 3, whatsappQuota: 2000, sortOrder: 2,
      features: { reports: true, bulk_import: true, parent_portal: true, posters: true, tests: true } },
    { code: "pro", name: "Pro", priceMonthly: 1999, maxStudents: 300, maxStaff: 6, whatsappQuota: 5000, sortOrder: 3,
      features: { reports: true, bulk_import: true, parent_portal: true, posters: true, tests: true, videos: true, exam_boards: true } },
    { code: "business", name: "Business", priceMonthly: 3499, maxStudents: 600, maxStaff: 10, whatsappQuota: 8000, sortOrder: 4,
      features: { custom_branding: true, priority_support: true } },
    { code: "premium", name: "Premium", priceMonthly: 4999, maxStudents: 900, maxStaff: 15, whatsappQuota: 12000, sortOrder: 5,
      features: { custom_branding: true, dedicated_onboarding: true } },
    { code: "enterprise", name: "Enterprise", priceMonthly: 6499, maxStudents: 1200, maxStaff: null, whatsappQuota: 20000, sortOrder: 6,
      features: { whatsapp_api: true, head_office: true, unlimited_staff: true } },
  ];
  for (const p of plans) {
    // Upsert by code so re-running updates prices/caps for the whole lineup.
    await db.insert(subscriptionPlans).values(p).onConflictDoUpdate({
      target: subscriptionPlans.code,
      set: { name: p.name, priceMonthly: p.priceMonthly, maxStudents: p.maxStudents, maxStaff: p.maxStaff, whatsappQuota: p.whatsappQuota, sortOrder: p.sortOrder, features: p.features, isActive: true },
    });
  }
  // Retire the old 3-tier "professional" code (replaced by "pro").
  await db.update(subscriptionPlans).set({ isActive: false }).where(eq(subscriptionPlans.code, "professional"));
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
