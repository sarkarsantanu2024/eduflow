-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0002 · Core Tables
-- Multi-tenant model: every tenant-owned row carries institute_id.
-- Audit columns (created_at, updated_at, created_by, updated_by) on all.
-- ════════════════════════════════════════════════════════════════════

-- ── Subscription plans (GLOBAL — not tenant scoped) ─────────────────
create table public.subscription_plans (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- 'starter' | 'growth' | 'professional'
  name              text not null,
  price_monthly     integer not null,                     -- in paise (₹499 -> 49900)
  currency          text not null default 'INR',
  max_students      integer,                              -- null = unlimited
  max_staff         integer,
  whatsapp_quota    integer,                              -- messages / month, null = unlimited
  features          jsonb not null default '{}'::jsonb,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Institutes (TENANT ROOT) ───────────────────────────────────────
create table public.institutes (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  type              public.institute_type not null default 'other',
  logo_url          text,
  address           text,
  city              text,
  state             text,
  pincode           text,
  phone             text,
  email             citext,
  website           text,
  gst_number        text,
  timezone          text not null default 'Asia/Kolkata',
  currency          text not null default 'INR',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Subscriptions (one active per institute) ───────────────────────
create table public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  plan_id           uuid not null references public.subscription_plans(id),
  status            public.subscription_status not null default 'trialing',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null,
  trial_ends_at     timestamptz,
  razorpay_subscription_id text,
  canceled_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Profiles (1:1 with auth.users) ─────────────────────────────────
-- Holds the tenant binding + role used by RLS. A super_admin has
-- institute_id = null and can operate across tenants.
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  institute_id      uuid references public.institutes(id) on delete cascade,
  role              public.user_role not null default 'institute_admin',
  full_name         text not null default '',
  email             citext,
  phone             text,
  avatar_url        text,
  is_active         boolean not null default true,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  constraint profiles_tenant_required
    check (role = 'super_admin' or institute_id is not null)
);

-- ── Courses ────────────────────────────────────────────────────────
create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  name              text not null,
  description       text,
  duration_months   integer,
  monthly_fee       integer not null default 0,           -- paise
  admission_fee     integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Batches ────────────────────────────────────────────────────────
create table public.batches (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  course_id         uuid references public.courses(id) on delete set null,
  teacher_id        uuid references public.profiles(id) on delete set null,
  name              text not null,
  timing            text,                                 -- e.g. '5:00 PM - 6:30 PM'
  days              text[] not null default '{}',         -- e.g. {Mon,Wed,Fri}
  capacity          integer,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Parents ────────────────────────────────────────────────────────
-- Optional auth-linked parent (user_id) for the Parent Portal (Phase 2).
create table public.parents (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  user_id           uuid references public.profiles(id) on delete set null,
  full_name         text not null,
  mobile            text not null,
  email             citext,
  address           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Students ───────────────────────────────────────────────────────
create table public.students (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_code      text not null,                        -- human-readable, unique per institute
  first_name        text not null,
  last_name         text,
  gender            public.gender,
  date_of_birth     date,
  admission_date    date not null default current_date,
  course_id         uuid references public.courses(id) on delete set null,
  primary_batch_id  uuid references public.batches(id) on delete set null,
  parent_id         uuid references public.parents(id) on delete set null,
  parent_name       text,
  parent_mobile     text,
  parent_email      citext,
  address           text,
  photo_url         text,
  status            public.student_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  constraint students_code_unique_per_institute unique (institute_id, student_code)
);

-- ── Student ↔ Batch (many-to-many enrolment) ───────────────────────
create table public.student_batches (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  batch_id          uuid not null references public.batches(id) on delete cascade,
  enrolled_on       date not null default current_date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  constraint student_batch_unique unique (student_id, batch_id)
);

-- ── Attendance (table created now; UI is Phase 2) ──────────────────
create table public.attendance (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  batch_id          uuid not null references public.batches(id) on delete cascade,
  attendance_date   date not null default current_date,
  present           boolean not null default true,
  note              text,
  marked_by         uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint attendance_unique_per_day unique (student_id, batch_id, attendance_date)
);

-- ── Fees (a billable charge for a student) ─────────────────────────
create table public.fees (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  course_id         uuid references public.courses(id) on delete set null,
  fee_type          public.fee_type not null default 'monthly',
  title             text not null,                        -- e.g. 'June 2026 Monthly Fee'
  amount            integer not null,                     -- paise, total billed
  amount_paid       integer not null default 0,           -- paise, sum of successful payments
  discount          integer not null default 0,
  period_month      integer,                              -- 1..12 for monthly fees
  period_year       integer,
  due_date          date not null,
  status            public.fee_status not null default 'pending',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  constraint fees_amount_positive check (amount >= 0),
  constraint fees_paid_not_negative check (amount_paid >= 0)
);

-- ── Payments (a transaction against one or more fees) ──────────────
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  fee_id            uuid references public.fees(id) on delete set null,
  amount            integer not null,                     -- paise
  currency          text not null default 'INR',
  method            public.payment_method not null default 'razorpay',
  status            public.payment_status not null default 'created',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_link_url  text,
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  constraint payments_amount_positive check (amount > 0)
);

-- ── Receipts (issued for a successful payment) ─────────────────────
create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  payment_id        uuid not null references public.payments(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  receipt_number    text not null,                        -- unique per institute
  amount            integer not null,
  pdf_url           text,                                 -- Supabase Storage path
  issued_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  constraint receipts_number_unique_per_institute unique (institute_id, receipt_number)
);

-- ── Message templates (reusable WhatsApp/email bodies) ─────────────
create table public.message_templates (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  name              text not null,
  reminder_type     public.reminder_type not null default 'custom',
  channel           public.reminder_channel not null default 'whatsapp',
  whatsapp_template_name text,                            -- approved Meta template name
  language          text not null default 'en',
  body              text not null,                        -- supports {{student_name}}, {{amount}}, {{due_date}}
  variables         text[] not null default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);

-- ── Reminders (a queued/sent message instance) ─────────────────────
create table public.reminders (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references public.institutes(id) on delete cascade,
  student_id        uuid references public.students(id) on delete set null,
  fee_id            uuid references public.fees(id) on delete set null,
  template_id       uuid references public.message_templates(id) on delete set null,
  reminder_type     public.reminder_type not null,
  channel           public.reminder_channel not null default 'whatsapp',
  recipient         text not null,                        -- phone or email
  rendered_body     text not null,
  status            public.delivery_status not null default 'queued',
  provider_message_id text,
  scheduled_for     timestamptz not null default now(),
  sent_at           timestamptz,
  delivered_at      timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid
);

-- ── Notifications (in-app, per user) ───────────────────────────────
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid references public.institutes(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  title             text not null,
  body              text,
  link              text,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ── Activity logs (audit trail) ────────────────────────────────────
create table public.activity_logs (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid references public.institutes(id) on delete cascade,
  actor_id          uuid references public.profiles(id) on delete set null,
  action            text not null,                        -- 'student.created', 'fee.paid', ...
  entity_type       text,
  entity_id         uuid,
  metadata          jsonb not null default '{}'::jsonb,
  ip_address        inet,
  created_at        timestamptz not null default now()
);
