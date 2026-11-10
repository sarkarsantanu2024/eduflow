# EduFlow

**Complete Institute Management, Fee Collection & WhatsApp Reminder Platform.**

A multi-tenant SaaS for abacus, coaching, tuition, dance, music, spoken-English,
yoga and computer-training centres, and for franchise head offices. Students,
monthly fees with UPI QR, expenses and profit, attendance, tests, certificates
and one-tap WhatsApp reminders.

Live: <https://eduflow.nexvoratechnologies.co.in>

> The `docs/` folder and the `supabase/` folder describe an earlier
> Supabase-based design that was replaced by Neon + Drizzle + Auth.js. They are
> kept for history; this README describes what actually runs.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, Server Actions) · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) |
| UI | Tailwind CSS · shadcn/ui (Radix) · lucide-react · Recharts |
| Client data | A small `useSyncExternalStore` store (`src/lib/store/local-db.ts`) loaded through one server action |
| Database | Neon serverless Postgres · Drizzle ORM (`neon-http` driver) |
| Auth | Auth.js v5, username + password (bcrypt), JWT sessions |
| Files | Vercel Blob |
| Messaging | WhatsApp deep links (`wa.me`) from the owner's own number, via an outbox. No WhatsApp API. |
| Payments | Manual UPI (QR with the amount pre-filled). No payment gateway. |
| Hosting | Vercel (one daily cron) |
| Tests | Vitest: unit tests plus integration tests on an in-memory Postgres (PGlite) |

## Quick start

```bash
npm install
cp .env.example .env.local        # DATABASE_URL, AUTH_SECRET, SUPERADMIN_* …
npm run db:migrate                # applies drizzle/*.sql in order (see below)
npm run db:seed                   # plans + the super-admin account
npm run dev                       # http://localhost:3000
npm test                          # unit + integration tests, no database needed
```

**Use a Neon branch for local work.** `.env.local`'s `DATABASE_URL` is whatever
database you point it at; never point it at production.

A centre owner signs up at **/register** (creates the tenant, an owner account
and a trial subscription). The super-admin console is **/admin**.

## Architecture at a glance

- **Multi-tenant by `institute_id`.** Tenant isolation is enforced in the
  application layer: every read and write in `src/features/data/actions.ts` is
  filtered by the caller's institute, the tenant id is stripped from client
  patches, and head-office access is re-checked on every request
  (`src/lib/tenant.ts`). There is no Postgres RLS.
- **Roles:** `super_admin` (platform owner) · `org_admin` (franchise head
  office) · `institute_admin` (centre owner) · `teacher` (limited staff login).
  `parent` exists in the schema but has no app yet.
- **Writes** are Server Actions. Teachers may write only attendance, tests,
  performance and promotions (`TEACHER_WRITABLE`).
- **Money** is integer rupees. Payments are applied to the oldest unpaid month
  first (`src/lib/money.ts`).
- **Daily cron** (`/api/cron/automation`, needs `CRON_SECRET`): generates the
  month's fees and recurring expenses (idempotent via partial unique indexes),
  then queues fee-due, overdue and birthday messages into each centre's outbox.
- **Sign-in and sign-up are rate limited** in Postgres (`src/lib/rate-limit.ts`),
  and platform-console actions are written to `activity_logs` (`src/lib/audit.ts`).

## Database and migrations

`drizzle/*.sql` is the source of truth, applied in filename order exactly once
by `scripts/migrate.mjs` (recorded in `_migrations`). Every migration is
additive and idempotent. On Vercel, `vercel-build` runs the tests, then the
migrations (production deploys only), then the build.

`src/lib/db/schema.ts` mirrors the SQL for Drizzle's types. If you change one,
change the other; the integration tests build their database from the SQL, so
drift between them fails the test run.

## Project layout

```text
src/app          routes: (auth), (dashboard), admin, org, api, verify
src/features     one folder per module (fees, students, automation, admin, …)
src/lib          db (schema, client), auth, tenant, money, rate-limit, audit
src/components   layout and shadcn/ui primitives
src/test         test helpers (in-memory Postgres)
drizzle          SQL migrations
scripts          migration runner, statement splitter, site CSS build
public           marketing site (site.html), privacy and terms
```

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Unit + integration tests (in-memory Postgres; no network) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply outstanding `drizzle/*.sql` to `.env.local`'s database |
| `npm run db:seed` | Plans and the super-admin account |

## Subscription plans

Source of truth: `SUBSCRIPTION_PLANS` in `src/lib/constants.ts`, mirrored into the
`subscription_plans` table by `src/lib/db/seed.ts`.

| Plan | Price (₹/mo) | Price (₹/yr) | Students | Staff logins |
|------|-------------:|-------------:|---------:|-------------:|
| Free | 0 | — | up to 20 | 1 |
| Starter | 399 | 3,999 | up to 100 | 3 |
| Growth ★ | 799 | 7,999 | up to 300 | 8 |
| Business | 1,499 | 14,999 | up to 1,000 | unlimited |
| Enterprise | Contact Sales | Contact Sales | unlimited | unlimited |

Add-ons: seat packs of +25 / +50 / +100 students · ₹399 per extra branch/month. Annual billing
is 10 months for 12 (~17% off) and is permanent, not a launch offer. All prices
exclude 18% GST.

**Size is the headline axis** — a center picks its plan by student count, the one
number an owner already knows. Modules layer on top of that: Free covers the
daily core (students, fees, UPI-QR, WhatsApp, attendance), Starter adds ID cards
and certificates, Growth adds the exam / money / staff block, Business adds
branding, analytics and multi-activity. See `src/lib/plan-gating.ts`.

Anything not shipped yet (parent app, teacher app, own domain, API, white label,
multi-branch, SSO) is listed with a **Coming soon** badge and never presented as
included today.

### Capacity enforcement

Student capacity is **prepaid and enforced server-side**. Effective cap is
`plan.max_students + subscription.extra_students`; `createRow` in
`src/features/data/actions.ts` refuses a student insert past it — the single
write path every add, PDF extract and bulk import goes through. Bulk imports are
refused whole rather than half-applied. Logic lives in `src/lib/plan-limits.ts`.

Nothing already in the account is touched at the limit; only the *next*
admission is blocked. `subscription.extra_students` is raised by a super-admin
once payment is received (there is no self-serve gateway yet), so the block
message points the owner at WhatsApp rather than a Pay button.

Staff-login caps are enforced separately in `src/features/staff/actions.ts`.

**Seat-pack flow** (no self-serve gateway yet, so the last step is manual):

1. Center reaches its limit. `/students/new` shows **Student limit reached**
   instead of the form — with the seat meter, a reassurance that existing data
   is untouched, and the seat packs.
2. Owner taps **+25 / +50 / +100 students**. That logs a row in
   `capacity_requests` *and* opens WhatsApp pre-filled with institute name,
   center ID, plan, current limit and active student count.
3. You reply with UPI/QR and the pack price (`SEAT_PACKS` in `constants.ts` —
   the per-student rate is internal and never shown to a customer).
4. Customer pays and sends proof.
5. You open **/admin/capacity**, mark it paid, then **Approve**. That applies the
   seats, writes a `capacity_events` row and closes the request in one step, so
   the grant and its audit trail can never drift apart.

Once a center outgrows seat packs — when the plan price plus the pack costs as
much as the next plan, or the seats would exceed what the next plan covers —
`getCapacityOffer` stops offering packs and recommends the upgrade instead.
Both the owner's screen and the admin queue show that recommendation.

Capacity history is visible to the owner on **/billing** and to a super-admin
per center on **/admin/capacity**.

## Status

In production with real centres. Built: everything described above.
Not built: parent app, automatic WhatsApp sending through Meta's API, a payment
gateway (seat packs and plans are paid by UPI and approved by hand), email.

Known limits, being worked on:

- Every screen loads the centre's whole dataset into the browser; fine at
  today's sizes, not at thousands of students per centre.
- Teachers' screens receive more of the centre's data than they display.
- Preview deployments share the production database.
