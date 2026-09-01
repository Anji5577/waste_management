-- SIGER waste segregation — report storage
--
-- Run this once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/<your-project-ref>/sql/new
--
-- A publishable (anon) key cannot execute DDL, which is why this is not applied
-- by the app at runtime.

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- Identifies the browser that filed the report. NOT a security boundary --
  -- see the RLS note below.
  device_id        text not null,

  -- ImgBB URLs. Both are PUBLIC: anyone holding the link can view the image.
  original_url     text not null,
  analyzed_url     text,
  delete_url       text,

  -- Verdict
  summary_headline text not null,
  summary_action   text,
  tally            jsonb not null default '{}'::jsonb,
  items            jsonb not null default '[]'::jsonb,
  scene            text,
  model            text,

  -- Where the photo was taken. Null for gallery uploads.
  latitude         double precision,
  longitude        double precision,
  accuracy_m       double precision,
  place_region     text,
  place_detail     text,

  taken_at         timestamptz
);

create index if not exists reports_device_created_idx
  on public.reports (device_id, created_at desc);

alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- SECURITY NOTE, read before going public.
--
-- The app has no sign-in, so these policies are open to the anonymous role.
-- `device_id` scopes what the dashboard *displays*; it does NOT restrict what
-- the database will return. Anyone with the publishable key -- which is in the
-- JavaScript bundle and therefore public -- can read every row.
--
-- That is acceptable for a demo or a single-operator tool. Before any real
-- deployment, add Supabase Auth and replace these with:
--
--   using (auth.uid() = user_id)  /  with check (auth.uid() = user_id)
--
-- and add a `user_id uuid references auth.users` column.
-- ---------------------------------------------------------------------------

drop policy if exists reports_anon_insert on public.reports;
create policy reports_anon_insert
  on public.reports for insert to anon with check (true);

drop policy if exists reports_anon_select on public.reports;
create policy reports_anon_select
  on public.reports for select to anon using (true);

-- Deliberately no update/delete policy: a filed report is a record, and the
-- anonymous role has no business rewriting one.
