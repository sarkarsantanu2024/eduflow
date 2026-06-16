# EduFlow — Deployment Guide

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Link the CLI and push migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push          # applies supabase/migrations/*
   ```
   For local dev: `npx supabase start` then `npx supabase db reset` (runs migrations + seed).
3. Confirm the three Storage buckets exist (`student-photos`, `institute-logos`,
   `receipts`) — created by migration `0005`.
4. **Auth** → set Site URL + redirect URLs to your domain
   (`https://app.eduflow.app/auth/callback`).
5. Generate types after schema changes: `npm run db:types`.

## 2. Environment variables

Copy `.env.example` → `.env.local` (local) and set the same keys in
**Vercel → Project → Settings → Environment Variables** (Production + Preview).

| Variable | Where | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Supabase → API | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API | **secret**, server only |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` | Razorpay dashboard | |
| `WHATSAPP_*` | Meta for Developers | permanent token |
| `CRON_SECRET` | self-generated | guards cron route |
| `NEXT_PUBLIC_APP_URL` | your domain | used in reset links |

## 3. Vercel deployment

1. Import the repo into Vercel; framework auto-detected (Next.js).
2. Set env vars (above). Build command `next build`, output is automatic.
3. `vercel.json` registers the daily reminder cron (`0 4 * * *`). Vercel Cron
   calls `/api/cron/reminders` with the `CRON_SECRET` Bearer token — set that in
   the cron's headers or rely on Vercel's signed cron + the secret check.
4. Add custom domain; Supabase Auth redirect URLs must match.

## 4. Razorpay & WhatsApp webhooks

- **Razorpay** → Settings → Webhooks → add
  `https://<domain>/api/webhooks/razorpay`, events
  `payment.captured`, `payment_link.paid`; secret = `RAZORPAY_WEBHOOK_SECRET`.
- **WhatsApp** (Meta) → configure delivery-status callback to your status webhook
  (to be added) with `WHATSAPP_VERIFY_TOKEN`.

## 5. Production checklist

### Security
- [ ] RLS enabled on **every** table (verify in Supabase → Auth → Policies).
- [ ] Service role key never referenced in any `"use client"` file.
- [ ] Webhook signatures verified (Razorpay HMAC, WhatsApp token).
- [ ] Cron routes require `CRON_SECRET`.
- [ ] Supabase Auth: email confirmations + rate limits configured.
- [ ] pgTAP / integration tests prove no cross-tenant leakage.

### Reliability
- [ ] DB backups / PITR enabled on Supabase.
- [ ] Sentry (or similar) wired for server + client errors.
- [ ] Webhook handlers idempotent.
- [ ] Indexes present on all `institute_id` + status/date filter columns.

### Performance & UX
- [ ] `next build` clean; no type errors (`npm run typecheck`).
- [ ] Images via `next/image` from the Supabase remote pattern.
- [ ] Lighthouse mobile pass (mobile-first).

### Compliance / business
- [ ] GST number captured per institute; receipts show it.
- [ ] Privacy policy + terms; data-retention policy.
- [ ] Subscription plan limits enforced (students/staff/WhatsApp quota).
```
