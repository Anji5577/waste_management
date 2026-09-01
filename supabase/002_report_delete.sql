-- Allow a report to be deleted from the dashboard.
--
-- Run after 001_reports.sql in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/<your-project-ref>/sql/new
--
-- 001 deliberately shipped no delete policy, on the reasoning that a filed
-- report is a record. That was the wrong default for a tool people use to try
-- things out: a mistaken photo of a colleague is not a record anyone wants kept,
-- and with no way to remove it the only recourse was the SQL editor.
--
-- SECURITY: with no sign-in, this grants the anonymous role delete on EVERY
-- row, not just the caller's own. The dashboard only ever sends ids it fetched
-- for this device_id, but the database cannot enforce that. Anyone holding the
-- publishable key -- which is in the JavaScript bundle -- can delete any report.
--
-- Before any real deployment, add Supabase Auth and replace this with:
--   using (auth.uid() = user_id)

drop policy if exists reports_anon_delete on public.reports;
create policy reports_anon_delete
  on public.reports for delete to anon using (true);
