# EduFlow — Development Roadmap & Phase Tasks

## Folder structure (`src/`)

```
src/
├── app/
│   ├── (auth)/                 login · register · forgot-password
│   ├── (dashboard)/            protected shell (sidebar + header)
│   │   ├── dashboard/          metrics
│   │   └── students/           list · new · [id]/edit
│   ├── api/
│   │   ├── cron/reminders/     scheduled WhatsApp dispatch
│   │   └── webhooks/razorpay/  payment confirmation
│   ├── auth/callback/          email-link session exchange
│   ├── layout.tsx · page.tsx · providers.tsx · globals.css
├── components/
│   ├── layout/                 sidebar · header
│   └── ui/                     shadcn primitives (button, input, table, …)
├── features/                   ← feature-based modules
│   ├── auth/                   schema · actions
│   ├── students/               schema · actions · queries · server · components
│   └── dashboard/              queries (metrics)
├── lib/                        env · utils · auth · activity · constants
│   └── supabase/               client · server · admin · middleware
├── services/                   whatsapp · razorpay
├── types/                      database.types.ts
└── middleware.ts               session refresh + route gating
supabase/                       migrations · seed.sql · config.toml
docs/                           architecture · database · api · roadmap · deployment
```

## Phase 1 — MVP (what this scaffold delivers / wires)

| # | Module | Status in scaffold |
|---|--------|--------------------|
| 1 | Auth (login/register/forgot/change) | ✅ actions + pages + middleware |
| 2 | Institute setup | ⚙️ tenant created on signup; settings form = TODO |
| 3 | Student management (CRUD, search, filter, bulk import, export) | ✅ CRUD/search/filter/import; export = TODO |
| 4 | Course management | ⚙️ schema + RLS; copy students pattern |
| 5 | Batch management | ⚙️ schema + RLS; copy students pattern |
| 6 | Fee management + PDF receipt | ⚙️ schema + RPCs; PDF gen = TODO |
| 7 | Payment collection (Razorpay) | ✅ service + webhook; UI link button = TODO |
| 8 | WhatsApp reminders + templates + scheduler | ✅ service + cron + templates table; UI = TODO |
| 9 | Dashboard | ✅ metrics query + cards |

Legend: ✅ implemented · ⚙️ foundation in place, follow the students pattern.

## Phase 1 task checklist (to finish MVP)

- [ ] Courses & Batches features (schema/actions/queries/components) — clone `features/students`
- [ ] Institute Settings page (logo upload → `institute-logos` bucket)
- [ ] Student photo upload (→ `student-photos` bucket) + CSV import UI + CSV/Excel export
- [ ] Fee generation (monthly auto-bill job) + fee table UI
- [ ] "Create payment link" action → Razorpay + send via WhatsApp
- [ ] Receipt PDF generation (react-pdf) → `receipts` bucket → signed URL
- [ ] Reminder composer + template CRUD + schedule UI; WhatsApp status webhook
- [ ] Dashboard charts (Recharts): collections trend, defaulters list
- [ ] Subscription/billing screen + plan limits enforcement
- [ ] RLS test suite (pgTAP) verifying cross-tenant isolation

## Phase 2
Attendance UI · Teacher module · Leave management · Student performance · Parent portal.

## Phase 3
Mobile app (Expo) · Online classes · Video library · Exams · Certificates · Franchise management.

## Suggested 16-week solo timeline

| Weeks | Focus |
|-------|-------|
| 1–2   | Supabase project, migrations, auth, app shell |
| 3–5   | Students + Courses + Batches (full CRUD, import/export) |
| 6–8   | Fees + Razorpay payments + receipts |
| 9–10  | WhatsApp templates + reminder scheduler |
| 11–12 | Dashboard, reports (PDF/Excel) |
| 13    | Subscriptions + plan limits |
| 14    | RLS tests, hardening, accessibility |
| 15    | Beta with 3–5 pilot institutes |
| 16    | Polish, launch |
