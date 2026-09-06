-- Keep calendar dates moving for posts that are still in production/review,
-- and publish posts that were explicitly scheduled once their time arrives.
create extension if not exists pg_cron;

create or replace function public.auto_publish_scheduled_posts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set status = 'published'::post_status,
      updated_at = now()
  where status = 'scheduled'::post_status
    and scheduled_date is not null
    and (scheduled_date + coalesce(scheduled_time, '00:00:00'::time)) <= (now() at time zone 'America/Sao_Paulo');

  update public.posts
  set scheduled_date = (now() at time zone 'America/Sao_Paulo')::date + 1,
      updated_at = now()
  where status in ('idea','production','recording','editing','review','changes_requested','approved','to_schedule')
    and scheduled_date is not null
    and scheduled_date < (now() at time zone 'America/Sao_Paulo')::date;
end
$$;

revoke execute on function public.auto_publish_scheduled_posts() from public, anon, authenticated;

do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname = 'rsm-post-status-rollover' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$$;

select cron.schedule(
  'rsm-post-status-rollover',
  '* * * * *',
  $cron$select public.auto_publish_scheduled_posts();$cron$
);

select public.auto_publish_scheduled_posts();
