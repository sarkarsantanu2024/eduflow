-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0004 · Row Level Security
--
-- Isolation model:
--   • super_admin            → full access across all tenants
--   • institute_admin/teacher/parent → access limited to their institute
--   • writes to most entities → admins only; teachers read + limited write
--
-- All tenant tables filter on institute_id = current_institute_id().
-- Helper fns (current_institute_id / is_super_admin / is_institute_admin)
-- are SECURITY DEFINER, defined in migration 0003.
-- ════════════════════════════════════════════════════════════════════

-- Enable RLS everywhere
alter table public.subscription_plans enable row level security;
alter table public.institutes        enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.batches           enable row level security;
alter table public.parents           enable row level security;
alter table public.students          enable row level security;
alter table public.student_batches   enable row level security;
alter table public.attendance        enable row level security;
alter table public.fees              enable row level security;
alter table public.payments          enable row level security;
alter table public.receipts          enable row level security;
alter table public.message_templates enable row level security;
alter table public.reminders         enable row level security;
alter table public.notifications     enable row level security;
alter table public.activity_logs     enable row level security;

-- ── subscription_plans: world-readable (pricing page), super_admin writes ─
create policy "plans readable by all authenticated"
  on public.subscription_plans for select to authenticated using (true);
create policy "plans writable by super_admin"
  on public.subscription_plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── institutes ──────────────────────────────────────────────────────
create policy "institutes: member can read own"
  on public.institutes for select to authenticated
  using (public.is_super_admin() or id = public.current_institute_id());
create policy "institutes: admin can update own"
  on public.institutes for update to authenticated
  using (public.is_institute_admin(id)) with check (public.is_institute_admin(id));
create policy "institutes: super_admin full"
  on public.institutes for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── subscriptions ───────────────────────────────────────────────────
create policy "subscriptions: read own"
  on public.subscriptions for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "subscriptions: super_admin manage"
  on public.subscriptions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── profiles ────────────────────────────────────────────────────────
-- A user can always read/update their own row (no helper fn → no recursion).
create policy "profiles: read self"
  on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Admins can read/manage profiles within their institute.
create policy "profiles: admin read tenant"
  on public.profiles for select to authenticated
  using (public.is_super_admin() or
         (public.current_user_role() = 'institute_admin'
          and institute_id = public.current_institute_id()));
create policy "profiles: admin manage tenant"
  on public.profiles for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- ── Generic tenant-scoped tables ────────────────────────────────────
-- SELECT for any institute member; WRITE for institute admins.
-- (Teachers get extra read/write grants below where appropriate.)

-- courses
create policy "courses: tenant read" on public.courses for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "courses: admin write" on public.courses for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- batches
create policy "batches: tenant read" on public.batches for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "batches: admin write" on public.batches for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- parents
create policy "parents: tenant read" on public.parents for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "parents: admin write" on public.parents for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- students
create policy "students: tenant read" on public.students for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "students: admin write" on public.students for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- student_batches
create policy "student_batches: tenant read" on public.student_batches for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "student_batches: admin write" on public.student_batches for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- attendance — teachers may write within their institute
create policy "attendance: tenant read" on public.attendance for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "attendance: staff write" on public.attendance for all to authenticated
  using (institute_id = public.current_institute_id()
         and public.current_user_role() in ('institute_admin','teacher'))
  with check (institute_id = public.current_institute_id()
         and public.current_user_role() in ('institute_admin','teacher'));

-- fees
create policy "fees: tenant read" on public.fees for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "fees: admin write" on public.fees for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- payments
create policy "payments: tenant read" on public.payments for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "payments: admin write" on public.payments for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- receipts
create policy "receipts: tenant read" on public.receipts for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "receipts: admin write" on public.receipts for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- message_templates
create policy "templates: tenant read" on public.message_templates for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "templates: admin write" on public.message_templates for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- reminders
create policy "reminders: tenant read" on public.reminders for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());
create policy "reminders: admin write" on public.reminders for all to authenticated
  using (public.is_institute_admin(institute_id))
  with check (public.is_institute_admin(institute_id));

-- notifications — each user sees only their own
create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- activity_logs — read within tenant; inserts via service role only
create policy "activity: tenant read" on public.activity_logs for select to authenticated
  using (public.is_super_admin() or institute_id = public.current_institute_id());

-- NOTE: The service role key bypasses RLS entirely. All privileged
-- server-side writes (webhooks, cron, log inserts) use it deliberately.
