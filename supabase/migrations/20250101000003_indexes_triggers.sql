-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0003 · Indexes, Triggers & Helper Functions
-- ════════════════════════════════════════════════════════════════════

-- ── Tenant-scoped indexes (every hot query filters by institute_id) ──
create index idx_subscriptions_institute on public.subscriptions (institute_id);
create index idx_profiles_institute on public.profiles (institute_id);
create index idx_profiles_role on public.profiles (role);
create index idx_courses_institute on public.courses (institute_id);
create index idx_batches_institute on public.batches (institute_id);
create index idx_batches_course on public.batches (course_id);
create index idx_batches_teacher on public.batches (teacher_id);
create index idx_parents_institute on public.parents (institute_id);
create index idx_students_institute on public.students (institute_id);
create index idx_students_status on public.students (institute_id, status);
create index idx_students_course on public.students (course_id);
create index idx_students_batch on public.students (primary_batch_id);
-- Trigram search on student names (fast ILIKE)
create index idx_students_name_trgm on public.students
  using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) extensions.gin_trgm_ops);
create index idx_student_batches_institute on public.student_batches (institute_id);
create index idx_student_batches_batch on public.student_batches (batch_id);
create index idx_attendance_institute_date on public.attendance (institute_id, attendance_date);
create index idx_fees_institute on public.fees (institute_id);
create index idx_fees_student on public.fees (student_id);
create index idx_fees_status on public.fees (institute_id, status);
create index idx_fees_due_date on public.fees (institute_id, due_date);
create index idx_payments_institute on public.payments (institute_id);
create index idx_payments_student on public.payments (student_id);
create index idx_payments_status on public.payments (institute_id, status);
create index idx_payments_rzp_order on public.payments (razorpay_order_id);
create index idx_receipts_institute on public.receipts (institute_id);
create index idx_receipts_payment on public.receipts (payment_id);
create index idx_templates_institute on public.message_templates (institute_id);
create index idx_reminders_institute on public.reminders (institute_id);
create index idx_reminders_status on public.reminders (institute_id, status);
create index idx_reminders_scheduled on public.reminders (scheduled_for) where status = 'queued';
create index idx_notifications_user on public.notifications (user_id, is_read);
create index idx_activity_institute on public.activity_logs (institute_id, created_at desc);

-- ── updated_at trigger ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'subscription_plans','institutes','subscriptions','profiles','courses',
    'batches','parents','students','fees','payments','message_templates','reminders'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- ── Auth helper functions (SECURITY DEFINER to avoid RLS recursion) ──
-- Returns the caller's institute_id from their profile.
create or replace function public.current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institute_id from public.profiles where id = auth.uid();
$$;

-- Returns the caller's role.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- True when caller is an admin (super or institute) for the given institute.
create or replace function public.is_institute_admin(target_institute uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'super_admin'
           or (p.role = 'institute_admin' and p.institute_id = target_institute))
  );
$$;

-- ── New auth user → bootstrap profile ───────────────────────────────
-- On signup we create a profile. institute_id/role are filled by the
-- onboarding flow (server action) using app metadata when present.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, institute_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'institute_admin'),
    nullif(new.raw_user_meta_data->>'institute_id','')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Recompute fee status from amount_paid ───────────────────────────
create or replace function public.recompute_fee_status(p_fee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select * into f from public.fees where id = p_fee_id for update;
  if not found then return; end if;

  update public.fees
  set status = case
        when f.amount_paid >= (f.amount - f.discount) then 'paid'::public.fee_status
        when f.amount_paid > 0 then 'partial'::public.fee_status
        when f.due_date < current_date then 'overdue'::public.fee_status
        else 'pending'::public.fee_status
      end
  where id = p_fee_id;
end;
$$;
