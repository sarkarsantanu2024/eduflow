import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");
  return { get db() { return holder.db; }, schema };
});

const { migratedDb } = await import("@/test/pglite");
const { clear, hit, isLimited } = await import("./rate-limit");

let env: Awaited<ReturnType<typeof migratedDb>>;
const limit = { max: 3, windowMinutes: 15 };

beforeAll(async () => {
  env = await migratedDb();
  holder.db = env.db;
}, 60_000);

afterAll(async () => {
  await env?.client.close();
});

describe("rate limiter (real Postgres)", () => {
  it("allows up to the limit, then blocks", async () => {
    const key = "login:user:asha";
    expect(await isLimited(key, limit)).toBe(false);
    await hit(key, limit);
    await hit(key, limit);
    expect(await isLimited(key, limit)).toBe(false);
    await hit(key, limit);
    expect(await isLimited(key, limit)).toBe(true);
  });

  it("keeps keys independent", async () => {
    expect(await isLimited("login:user:bimal", limit)).toBe(false);
  });

  it("clear() forgets a key", async () => {
    await clear("login:user:asha");
    expect(await isLimited("login:user:asha", limit)).toBe(false);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const key = "login:ip:10.0.0.1";
    for (let i = 0; i < 3; i++) await hit(key, limit);
    expect(await isLimited(key, limit)).toBe(true);
    await env.db.execute(sql`update rate_limits set window_start = now() - interval '16 minutes' where key = ${key}`);
    expect(await isLimited(key, limit)).toBe(false);
    await hit(key, limit);
    const rows = await env.db.execute(sql`select count from rate_limits where key = ${key}`);
    expect(rows.rows[0]).toMatchObject({ count: 1 });
  });
});
