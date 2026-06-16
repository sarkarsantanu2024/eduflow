# EduFlow — High-Level Architecture

> Multi-tenant SaaS for institute management, fee collection & WhatsApp reminders.
> Target scale: 10,000+ institutes (tenants), each isolated by `institute_id`.

## 1. System overview

```
            ┌──────────────────────────────────────────────────────┐
            │                     Browser (PWA)                      │
            │   Next.js 15 App Router · React 19 · Tailwind · shadcn │
            │   TanStack Query (client cache) · RHF + Zod (forms)    │
            └───────────────┬───────────────────────┬───────────────┘
                            │ Server Components       │ Server Actions
                            │ (RSC, RLS-scoped reads) │ (mutations)
            ┌───────────────▼───────────────────────▼───────────────┐
            │                  Next.js server (Vercel)               │
            │  • middleware: session refresh + route gating          │
            │  • server actions: validated writes (Zod)              │
            │  • route handlers: webhooks, cron, auth callback       │
            │  • services: WhatsApp Cloud API, Razorpay              │
            └───────┬─────────────────────┬───────────────┬─────────┘
          anon key  │            service   │     external  │
          (RLS on)  │            role key  │     HTTPS     │
            ┌───────▼──────────┐  ┌────────▼───────┐  ┌────▼──────────┐
            │  Supabase        │  │ Supabase admin │  │  Razorpay     │
            │  Postgres + RLS  │  │ (bypasses RLS) │  │  WhatsApp API │
            │  Auth · Storage  │  │ webhooks/cron  │  │  Email        │
            └──────────────────┘  └────────────────┘  └───────────────┘
```

## 2. Multi-tenancy model

- **Strategy:** shared database, shared schema, row-level isolation by `institute_id`.
- Every tenant-owned table carries a non-null `institute_id` FK to `institutes`.
- Isolation is enforced in the database via **Postgres Row Level Security**, not
  application code — a missed `WHERE` clause cannot leak another tenant's data.
- The caller's tenant + role are resolved from `public.profiles` (1:1 with
  `auth.users`) through `SECURITY DEFINER` helper functions
  (`current_institute_id()`, `current_user_role()`, `is_institute_admin()`).

### Roles

| Role              | Scope            | Capabilities                                            |
|-------------------|------------------|---------------------------------------------------------|
| `super_admin`     | platform-wide    | Manage plans, all tenants, support. `institute_id` null |
| `institute_admin` | one institute    | Full CRUD within tenant; billing; reminders             |
| `teacher`         | one institute    | Read students/batches; mark attendance                  |
| `parent`          | own children     | (Phase 2) view fees, receipts, attendance               |

## 3. Trust boundaries & keys

| Client                | Key               | RLS    | Used for                                  |
|-----------------------|-------------------|--------|-------------------------------------------|
| `supabase/client.ts`  | anon              | ON     | Browser reads/writes (TanStack Query)     |
| `supabase/server.ts`  | anon              | ON     | RSC + server-action reads/writes          |
| `supabase/admin.ts`   | service role      | **OFF**| Webhooks, cron, signup tenant creation, logs |

The service role key is server-only (`import "server-only"`) and never reaches
the browser bundle. All privileged writes are deliberate and audited.

## 4. Request lifecycle (write)

1. User submits a form → React Hook Form validates against the **Zod schema**.
2. Client calls a **Server Action** with typed values.
3. The action re-validates with the **same Zod schema** (never trust the client),
   resolves the tenant via `requireTenant()`, and sets `institute_id` server-side.
4. Supabase insert/update runs under the user's RLS context (defense in depth:
   the action also scopes `.eq("institute_id", …)`).
5. `logActivity()` appends to `activity_logs` (service role, fire-and-forget).
6. `revalidatePath()` refreshes the RSC cache; TanStack Query invalidates.

## 5. Asynchronous flows

- **Payments:** create a Razorpay payment link → user pays → Razorpay
  **webhook** (`/api/webhooks/razorpay`) verifies the HMAC signature, marks the
  payment `success`, and atomically updates the fee via the
  `increment_fee_payment` RPC.
- **Reminders:** a **Vercel Cron** job (`/api/cron/reminders`, daily) drains
  `reminders` rows that are `queued` and due, sends them through the WhatsApp
  Cloud API, and records `sent`/`failed` + provider message id. WhatsApp status
  webhooks later flip rows to `delivered`/`read`.

## 6. Key user flows

- **Onboarding:** Register → tenant + admin profile created → land on dashboard.
- **Admissions:** Add student → assign course/batch → auto-generate monthly fees.
- **Collection:** Generate fee → send payment link via WhatsApp → webhook marks
  paid → receipt PDF stored in private `receipts` bucket (signed URL).
- **Dunning:** Cron finds overdue fees → queues `fee_overdue` reminders from the
  tenant's templates → WhatsApp dispatch.

## 7. Folder structure

See [`docs/04-roadmap.md`](./04-roadmap.md) and the repo README. The app uses a
**feature-based** layout under `src/features/<feature>` (schema, actions,
queries, components co-located) with shared primitives in `src/components/ui`,
cross-cutting infra in `src/lib`, and third-party integrations in `src/services`.
