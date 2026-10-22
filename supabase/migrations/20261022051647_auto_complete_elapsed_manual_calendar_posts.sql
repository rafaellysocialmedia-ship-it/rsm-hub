-- Auto-advance calendar-only/manual scheduled posts when their date and time have elapsed.
-- This is internal editorial status tracking, NOT proof of publishing on Instagram,
-- Meta or any other external platform. Externally queued posts are excluded.
create or replace function rsm_private.complete_elapsed_manual_calendar_posts()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.posts as p
     set status = 'published'::public.post_status,
         updated_at = clock_timestamp()
   where p.status = 'scheduled'::public.post_status
     and p.publication_source = 'manual'
     and p.scheduled_date is not null
     and p.scheduled_time is not null
     and (p.scheduled_date + p.scheduled_time)
         <= (clock_timestamp() at time zone public.calendar_timezone());

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function rsm_private.complete_elapsed_manual_calendar_posts()
  from public, anon, authenticated;

-- Keep existing daily rollover untouched. pg_cron runs in production without
-- requiring any user to be logged in or the frontend to remain open.
select cron.schedule(
  'rsm-manual-calendar-status-completion',
  '* * * * *',
  'select rsm_private.complete_elapsed_manual_calendar_posts();'
);
