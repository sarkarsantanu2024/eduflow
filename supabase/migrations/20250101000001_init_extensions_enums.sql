-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0001 · Extensions & Enums
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ── Enums ───────────────────────────────────────────────────────────
create type public.user_role as enum (
  'super_admin',   -- platform owner (EduFlow staff)
  'institute_admin',
  'teacher',
  'parent'
);

create type public.gender as enum ('male', 'female', 'other');

create type public.student_status as enum ('active', 'inactive', 'graduated', 'dropped');

create type public.fee_type as enum ('monthly', 'admission', 'exam', 'other');

create type public.fee_status as enum ('pending', 'partial', 'paid', 'overdue', 'waived');

create type public.payment_status as enum ('created', 'pending', 'success', 'failed', 'refunded');

create type public.payment_method as enum ('razorpay', 'cash', 'upi', 'bank_transfer', 'cheque', 'other');

create type public.reminder_type as enum (
  'fee_due', 'fee_overdue', 'admission_renewal', 'exam_reminder',
  'birthday', 'holiday_notice', 'custom'
);

create type public.reminder_channel as enum ('whatsapp', 'email', 'sms');

create type public.delivery_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

create type public.institute_type as enum (
  'abacus', 'coaching', 'tuition', 'dance', 'music',
  'spoken_english', 'computer_training', 'other'
);
