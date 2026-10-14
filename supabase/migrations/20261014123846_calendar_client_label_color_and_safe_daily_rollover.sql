-- Custom label colors persist for each client; NULL uses the original automatic palette.
alter table public.clients
  add column if not exists calendar_label_color text;

alter table public.clients
  add constraint clients_calendar_label_color_hex
  check (calendar_label_color is null or calendar_label_color ~ '^#[0-9A-Fa-f]{6}$');

-- Only advance unfinished calendar items, preserving the existing approval
-- triggers and audit trail. Never infer successful publishing from elapsed time.
create or replace function rsm_private.rollover_unfinished_calendar_posts()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_work_day date;
  affected integer;
begin
  current_work_day := (now() at time zone public.calendar_timezone())::date;

  update public.posts as p
     set scheduled_date = current_work_day + 1,
         updated_at = clock_timestamp()
   where p.scheduled_date is not null
     and p.scheduled_date <= current_work_day
     and p.status in (
       'idea', 'production', 'recording', 'editing',
       'review', 'changes_requested', 'approved', 'to_schedule'
     )
     and (p.publication_source is null or p.publication_source = 'manual');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function rsm_private.rollover_unfinished_calendar_posts()
from public, anon, authenticated;

-- Reuse the disabled cron job with a safe rollover-only command.
-- Supabase pg_cron uses UTC. 03:15 UTC is 00:15 America/Fortaleza.
do $$
declare
  old_job bigint;
begin
  select jobid into old_job
    from cron.job where jobname = 'rsm-post-status-rollover'
    order by jobid limit 1;
  if old_job is null then
    perform cron.schedule(
      'rsm-post-status-rollover',
      '15 3 * * *',
      'select rsm_private.rollover_unfinished_calendar_posts();'
    );
  else
    perform cron.alter_job(
      job_id := old_job,
      schedule := '15 3 * * *',
      command := 'select rsm_private.rollover_unfinished_calendar_posts();',
      active := true
    );
  end if;
end;
$$;
