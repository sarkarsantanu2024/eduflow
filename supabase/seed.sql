-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Seed Data (local dev)
-- Run automatically by `supabase db reset`.
--
-- NOTE: auth.users / profiles are created by the signup flow. For a
-- fully wired local demo, create a user in Supabase Studio, then update
-- the placeholder profile UPDATE at the bottom with that user's UUID.
-- ════════════════════════════════════════════════════════════════════

-- ── Subscription plans (global) ─────────────────────────────────────
insert into public.subscription_plans (code, name, price_monthly, max_students, max_staff, whatsapp_quota, sort_order, features)
values
  ('starter',      'Starter',      49900,  100,   3,  500,  1,
    '{"reports":false,"bulk_import":true,"parent_portal":false}'),
  ('growth',       'Growth',       99900,  500,   10, 2000, 2,
    '{"reports":true,"bulk_import":true,"parent_portal":true}'),
  ('professional', 'Professional', 199900, null,  null, null, 3,
    '{"reports":true,"bulk_import":true,"parent_portal":true,"api_access":true}')
on conflict (code) do nothing;

-- ── Demo institute (tenant) ─────────────────────────────────────────
insert into public.institutes (id, name, slug, type, phone, email, city, state, gst_number)
values (
  '11111111-1111-1111-1111-111111111111',
  'Bright Minds Abacus Academy', 'bright-minds', 'abacus',
  '+919800000000', 'admin@brightminds.test', 'Kolkata', 'West Bengal', '19ABCDE1234F1Z5'
) on conflict (id) do nothing;

-- ── Subscription for demo institute ─────────────────────────────────
insert into public.subscriptions (institute_id, plan_id, status, current_period_end, trial_ends_at)
select '11111111-1111-1111-1111-111111111111', id, 'trialing',
       now() + interval '30 days', now() + interval '14 days'
from public.subscription_plans where code = 'growth'
on conflict do nothing;

-- ── Courses ─────────────────────────────────────────────────────────
insert into public.courses (id, institute_id, name, description, duration_months, monthly_fee, admission_fee)
values
  ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'Abacus Level 1','Foundation abacus & mental math',12,80000,50000),
  ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
   'Abacus Level 2','Intermediate abacus',12,100000,50000)
on conflict (id) do nothing;

-- ── Batches ─────────────────────────────────────────────────────────
insert into public.batches (id, institute_id, course_id, name, timing, days, capacity)
values
  ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001','Evening Batch A','5:00 PM - 6:30 PM',
   array['Mon','Wed','Fri'],20)
on conflict (id) do nothing;

-- ── Students ────────────────────────────────────────────────────────
insert into public.students
  (institute_id, student_code, first_name, last_name, gender, date_of_birth,
   course_id, primary_batch_id, parent_name, parent_mobile, status)
values
  ('11111111-1111-1111-1111-111111111111','BM-0001','Aarav','Sharma','male','2015-04-12',
   '22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',
   'Rohit Sharma','+919811111111','active'),
  ('11111111-1111-1111-1111-111111111111','BM-0002','Diya','Gupta','female','2014-09-30',
   '22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',
   'Anil Gupta','+919822222222','active')
on conflict (institute_id, student_code) do nothing;

-- ── Message templates ───────────────────────────────────────────────
insert into public.message_templates (institute_id, name, reminder_type, channel, language, body, variables)
values
  ('11111111-1111-1111-1111-111111111111','Fee Due Reminder','fee_due','whatsapp','en',
   'Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. Please pay to avoid late charges. — Bright Minds',
   array['parent_name','amount','student_name','due_date']),
  ('11111111-1111-1111-1111-111111111111','Birthday Wish','birthday','whatsapp','en',
   'Happy Birthday {{student_name}}! 🎉 Wishing you a wonderful year ahead. — Bright Minds',
   array['student_name'])
on conflict do nothing;

-- ── (Optional) bind a real auth user to this tenant as admin ────────
-- After creating a user in Studio, run:
--   update public.profiles
--   set institute_id = '11111111-1111-1111-1111-111111111111',
--       role = 'institute_admin', full_name = 'Demo Admin'
--   where email = 'admin@brightminds.test';
