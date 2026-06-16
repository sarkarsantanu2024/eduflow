# EduFlow

**Complete Institute Management, Fee Collection & WhatsApp Reminder Platform.**

A multi-tenant SaaS for abacus, coaching, tuition, dance, music, spoken-English
and computer-training centers. Manage students, collect fees online, and send
automatic WhatsApp reminders — built to scale to 10,000+ institutes.

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

| Plan | Price (₹/mo) | Students |
|------|--------------|----------|
| Starter | 499 | up to 100 |
| Growth | 999 | up to 500 |
| Professional | 1999 | unlimited |

## Status

Phase-1 foundation: auth, multi-tenant DB + RLS, students CRUD, dashboard
metrics, payment & reminder plumbing. See the roadmap for the remaining MVP
checklist.
