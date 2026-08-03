# EduFlow

**Complete Institute Management, Fee Collection & WhatsApp Reminder Platform.**

A multi-tenant SaaS for abacus, coaching, tuition, dance, music, spoken-English
and computer-training centers. Manage students, collect fees online, and send
one-click WhatsApp reminders — built to scale to 10,000+ institutes.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, RSC, Server Actions) · React 19 · TypeScript (strict) |
| UI | Tailwind CSS · shadcn/ui · lucide-react · Recharts |
| Data (client) | TanStack Query |
| Forms | React Hook Form + Zod |
| Backend | Supabase (Postgres + Auth + Storage) with **Row Level Security** |
| Payments | Razorpay (payment links + webhooks) |
| Messaging | WhatsApp Cloud API · Email |
| Hosting | Vercel + Supabase |

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local        # fill in Supabase + Razorpay + WhatsApp keys

# 3. Database (local Supabase)
npx supabase start
npx supabase db reset             # runs migrations + seed.sql
npm run db:types                  # regenerate src/types/database.types.ts

# 4. Run
npm run dev                       # http://localhost:3000
```

Create a user via the **/register** page (creates a tenant + admin), or in
Supabase Studio then bind it to the demo institute using the snippet at the
bottom of `supabase/seed.sql`.

## Architecture at a glance

- **Multi-tenant**, isolated by `institute_id`, enforced by Postgres RLS.
- **Roles:** super_admin · institute_admin · teacher · parent.
- **Mutations** are Server Actions (Zod-validated, tenant set server-side).
- **Reads** are RLS-scoped Supabase queries (RSC + TanStack Query).
- **Async:** Razorpay webhook confirms payments; Vercel Cron dispatches reminders.

Full docs in [`docs/`](./docs):
[Architecture](./docs/01-architecture.md) ·
[Database & ERD](./docs/02-database.md) ·
[API & Actions](./docs/03-api.md) ·
[Roadmap & Tasks](./docs/04-roadmap.md) ·
[Deployment](./docs/05-deployment.md).

## Project layout

```
src/app          routes (auth group, dashboard group, api, auth callback)
src/components    layout + shadcn ui primitives
src/features      feature modules: auth, students, dashboard (schema/actions/queries/components)
src/lib           env, utils, auth guards, activity log, supabase clients
src/services      whatsapp, razorpay
src/types         database types
supabase          migrations, seed, config
docs              architecture & ops docs
```

## The "reference feature" pattern

`src/features/students` is the canonical example every other feature copies:

| File | Responsibility |
|------|----------------|
| `schema.ts` | Zod schemas (shared by form + server action) |
| `actions.ts` | `"use server"` mutations → `ActionResult<T>` |
| `queries.ts` | `"use client"` TanStack Query hooks |
| `server.ts` | server-only read helpers for RSC pages |
| `components/` | table + form (RHF) |

To add Courses/Batches/Fees: clone this folder, swap the table + fields.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:reset` | Reset local DB (migrations + seed) |
| `npm run db:push` | Push migrations to linked project |
| `npm run db:types` | Generate TS types from DB |

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

Phase-1 foundation: auth, multi-tenant DB + RLS, students CRUD, dashboard
metrics, payment & reminder plumbing. See the roadmap for the remaining MVP
checklist.
