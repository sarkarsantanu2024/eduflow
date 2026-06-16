# EduFlow — API & Server-Action Contracts

EduFlow is **API-light by design**: mutations are **Server Actions**, reads are
RLS-scoped Supabase queries (from RSC or TanStack Query). HTTP route handlers
exist only where an external caller or scheduler needs them.

## Conventions

- All actions return a discriminated result:
  ```ts
  type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
  ```
- Inputs are validated with the feature's Zod schema **on the server** (the
  client validation is UX only).
- `institute_id` is always derived from the session, never accepted from input.

## Server Actions

### Auth — `src/features/auth/actions.ts`
| Action | Input | Effect |
|--------|-------|--------|
| `signIn` | email, password | Sign in; redirect `/dashboard` |
| `signUp` | instituteName, fullName, email, password | Create tenant + admin user, sign in |
| `requestPasswordReset` | email | Send reset email (always succeeds — no enumeration) |
| `updatePassword` | password | Update current user's password |
| `signOut` | — | Sign out; redirect `/login` |

### Students — `src/features/students/actions.ts`
| Action | Input | Returns |
|--------|-------|---------|
| `createStudent` | `StudentFormValues` | `ActionResult<StudentRow>` |
| `updateStudent` | id, `StudentFormValues` | `ActionResult<StudentRow>` |
| `deleteStudent` | id | `ActionResult<void>` |
| `bulkImportStudents` | `StudentFormValues[]` | `ActionResult<{ inserted }>` |

> Other features (courses, batches, fees, payments, reminders) follow the **same
> four-file pattern**: `schema.ts` (Zod), `actions.ts` (mutations),
> `queries.ts` (TanStack hooks), `components/` (UI).

## HTTP Route Handlers

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/callback` | GET | code in URL | Exchange email-link code for session |
| `/api/webhooks/razorpay` | POST | HMAC signature | Mark payment paid, update fee |
| `/api/cron/reminders` | GET | `Bearer CRON_SECRET` | Dispatch due WhatsApp reminders |

### Razorpay webhook payload (handled)
- `payment.captured`, `payment_link.paid` → set `payments.status='success'`,
  store `razorpay_payment_id`, call `increment_fee_payment`.
- Signature verified with `RAZORPAY_WEBHOOK_SECRET` (constant-time compare).
- Idempotent on `razorpay_order_id` / `razorpay_payment_id`.

## Data access (reads)

Reads go directly to Supabase under RLS:
- **Server:** `createClient()` from `src/lib/supabase/server.ts` in RSC.
- **Client:** `createClient()` from `src/lib/supabase/client.ts` inside TanStack
  Query `queryFn` (see `students/queries.ts` for pagination/search/filter).

Example list query key + filter (students):
```
["students","list", { search, status, courseId, page, pageSize }]
→ .from("students").select("*",{count:"exact"}).range(...)
   .eq("status", …).or("first_name.ilike.%term%,...")
```
