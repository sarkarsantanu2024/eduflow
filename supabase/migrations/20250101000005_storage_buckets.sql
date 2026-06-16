-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0005 · Storage Buckets & Policies
--
-- Convention: objects are stored under  <institute_id>/<entity>/<file>
-- so the first path segment is the tenant boundary. Storage RLS checks
-- that segment against the caller's institute.
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('student-photos',  'student-photos',  true,  5242880,  array['image/png','image/jpeg','image/webp']),
  ('institute-logos', 'institute-logos', true,  2097152,  array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('receipts',        'receipts',        false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Helper: first path segment = institute_id
-- storage.foldername(name) returns text[] of path segments.

-- ── student-photos (public read; tenant admins write) ───────────────
create policy "student-photos: public read"
  on storage.objects for select
  using (bucket_id = 'student-photos');

create policy "student-photos: tenant admin write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and public.is_institute_admin((storage.foldername(name))[1]::uuid)
  );

create policy "student-photos: tenant admin modify"
  on storage.objects for update to authenticated
  using (bucket_id = 'student-photos'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));

create policy "student-photos: tenant admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));

-- ── institute-logos (public read; tenant admins write) ──────────────
create policy "institute-logos: public read"
  on storage.objects for select
  using (bucket_id = 'institute-logos');

create policy "institute-logos: tenant admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'institute-logos'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));

create policy "institute-logos: tenant admin modify"
  on storage.objects for update to authenticated
  using (bucket_id = 'institute-logos'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));

create policy "institute-logos: tenant admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'institute-logos'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));

-- ── receipts (PRIVATE — signed URLs only; tenant members read) ──────
create policy "receipts: tenant read"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts'
         and (public.is_super_admin()
              or (storage.foldername(name))[1]::uuid = public.current_institute_id()));

create policy "receipts: tenant admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts'
         and public.is_institute_admin((storage.foldername(name))[1]::uuid));
