import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Monthly billing against a real Postgres with the real migrations.
 *
 * The 42P10 bug (ON CONFLICT without the partial index predicate) passed every
 * unit test and failed every insert in production from 2026-09-06 until it was
 * found by reading the code. This is the test that would have caught it.
 */

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");
  return {
    get db() {
      return holder.db;
    },
    schema,
  };
});

const { migratedDb } = await import("@/test/pglite");
const { runMonthlyBilling } = await import("./billing");
const { istToday } = await import("./engine");
const { expenses, fees, institutes, students } = await import("@/lib/db/schema");

let db: Awaited<ReturnType<typeof migratedDb>>["db"];
let client: Awaited<ReturnType<typeof migratedDb>>["client"];
let instituteId: string;
const ym = istToday().ymd.slice(0, 7);

beforeAll(async () => {
  ({ db, client } = await migratedDb());
  holder.db = db;

  const [inst] = await db
    .insert(institutes)
    .values({
      name: "Test Centre",
      slug: "test-centre",
      monthlyFee: 500,
      recurringCharges: [{ id: "rent", name: "Rent", category: "Rent", basis: "fixed", amount: 2000 }],
    } as typeof institutes.$inferInsert)
    .returning({ id: institutes.id });
  instituteId = inst!.id;

  await db.insert(students).values([
    { instituteId, code: "S1", firstName: "Asha", status: "active" },
    { instituteId, code: "S2", firstName: "Bimal", status: "active", monthlyFee: 700 },
    { instituteId, code: "S3", firstName: "Chitra", status: "inactive" },
  ] as (typeof students.$inferInsert)[]);
}, 60_000);

afterAll(async () => {
  await client?.close();
});

describe("runMonthlyBilling (real Postgres)", () => {
  it("creates this month's fee for every active student, at the right amount", async () => {
    const result = await runMonthlyBilling(instituteId);
    expect(result.feesCreated).toBe(2);

    const rows = await db
      .select({ name: fees.studentName, amount: fees.amount, period: fees.period, status: fees.status })
      .from(fees)
      .where(and(eq(fees.instituteId, instituteId), eq(fees.kind, "monthly")));
    expect(rows.map((r) => [r.name, r.amount, r.period]).sort()).toEqual([
      ["Asha", 500, ym],
      ["Bimal", 700, ym],
    ]);
  });

  it("posts the recurring charge as an expense", async () => {
    const rows = await db.select({ amount: expenses.amount }).from(expenses).where(eq(expenses.instituteId, instituteId));
    expect(rows).toEqual([{ amount: 2000 }]);
  });

  it("is idempotent: running again creates nothing and does not throw", async () => {
    const again = await runMonthlyBilling(instituteId);
    expect(again).toMatchObject({ feesCreated: 0, expensesCreated: 0 });
    const count = await db.select({ id: fees.id }).from(fees).where(eq(fees.instituteId, instituteId));
    expect(count).toHaveLength(2);
  });

  it("the partial unique index still lets a trashed fee be re-created", async () => {
    await db.update(fees).set({ deletedAt: new Date() }).where(and(eq(fees.instituteId, instituteId), eq(fees.studentName, "Asha")));
    const result = await runMonthlyBilling(instituteId);
    expect(result.feesCreated).toBe(1);
    const live = await db
      .select({ id: fees.id })
      .from(fees)
      .where(and(eq(fees.instituteId, instituteId), eq(fees.studentName, "Asha"), isNull(fees.deletedAt)));
    expect(live).toHaveLength(1);
  });
});
