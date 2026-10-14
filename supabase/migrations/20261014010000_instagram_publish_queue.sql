-- Instagram Feed JPEG publishing queue. Apply ONLY to isolated staging first.
-- Editing an editorial post cannot claim that Instagram itself has scheduled it.
create table public.instagram_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid references public.instagram_connections(id) on delete set null,
  content_revision integer not null,
  scheduled_for timestamptz,
  status text not null default 'blocked'
    check (status in ('queued','blocked','processing','prepared','publishing','published','failed','uncertain','cancelled')),
  reason_code text,
  creation_id text,
  published_media_id text,
  attempts integer not null default 0,
  lease_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index instagram_jobs_due on public.instagram_publish_jobs(scheduled_for,id)
  where status in ('queued','prepared');
alter table public.instagram_publish_jobs enable row level security;
revoke all on public.instagram_publish_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.instagram_publish_jobs to service_role;

-- AFTER trigger uses a restricted SECURITY DEFINER function solely to maintain the
-- private queue. It cannot be called from the API and never returns credentials.
create function public.sync_instagram_publish_job() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  network_enabled boolean;
  connected uuid;
  matching integer;
  media_count integer;
  jpeg_count integer;
  active_client boolean;
  is_approved boolean;
  scheduled timestamptz;
  reason text;
begin
  p := new;
  network_enabled := 'Instagram' = any(coalesce(p.social_networks,'{}'::text[]))
                     or (coalesce(array_length(p.social_networks,1),0)=0 and p.social_network='Instagram');
  if not network_enabled or p.status <> 'scheduled' or p.client_id is null then
    update public.instagram_publish_jobs set status='cancelled',reason_code='editorial_changed',
      updated_at=clock_timestamp()
      where post_id=p.id and status in ('queued','blocked','prepared','failed');
    return null;
  end if;
  -- Never replace an in-flight or published job (would risk duplicate publishing).
  if exists(select 1 from public.instagram_publish_jobs
      where post_id=p.id and status in ('processing','publishing','published','uncertain')) then
    return null;
  end if;

  select status='active' and not coalesce(churned,false) into active_client
    from public.clients where id=p.client_id;
  select count(*), (array_agg(id))[1] into matching,connected
    from public.instagram_connections where client_id=p.client_id
      and token_expires_at > clock_timestamp();
  select count(*), count(*) filter(where mime_type in ('image/jpeg','image/jpg')
    and lower(storage_path) ~ '[.]jpe?g) into media_count,jpeg_count
    from public.post_files where post_id=p.id;

  select not exists(select 1 from public.post_approvals a where a.post_id=p.id)
    or exists(select 1 from public.post_approvals a where a.post_id=p.id
      and a.decision='approved' and a.reviewed_revision=p.content_revision)
    into is_approved;
  if p.scheduled_date is not null and p.scheduled_time is not null then
    scheduled := (p.scheduled_date + p.scheduled_time) at time zone 'America/Sao_Paulo';
  end if;
  reason := case
    when not coalesce(active_client,false) then 'inactive_client'
    when scheduled is null then 'missing_date_time'
    when scheduled <= clock_timestamp() then 'past_schedule'
    when matching=0 then 'account_not_connected'
    when matching>1 then 'multiple_accounts'
    when not is_approved then 'awaiting_approval'
    when p.format is distinct from 'Feed' then 'unsupported_format'
    when media_count<>1 or jpeg_count<>1 then 'single_jpeg_required'
    when nullif(trim(coalesce(p.caption,'')),'') is null then 'caption_required'
    else null
  end;

  insert into public.instagram_publish_jobs(
    post_id,client_id,connection_id,content_revision,scheduled_for,status,reason_code,updated_at)
  values (p.id,p.client_id,case when matching=1 then connected else null end,
    p.content_revision,scheduled,case when reason is null then 'queued' else 'blocked' end,reason,clock_timestamp())
  on conflict (post_id) do update set
    client_id=excluded.client_id,connection_id=excluded.connection_id,
    content_revision=excluded.content_revision,scheduled_for=excluded.scheduled_for,
    status=excluded.status,reason_code=excluded.reason_code,
    creation_id=null,published_media_id=null,attempts=0,lease_at=null,
    published_at=null,updated_at=clock_timestamp()
  where public.instagram_publish_jobs.status not in ('processing','publishing','published','uncertain');
  return null;
end $$;
revoke all on function public.sync_instagram_publish_job() from public, anon, authenticated, service_role;
create trigger zzz_sync_instagram_publish_job after insert or update
  on public.posts for each row execute function public.sync_instagram_publish_job();
-- The existing media revision trigger updates posts and therefore also refreshes
-- the publication queue, invalidating an approval when the media changes.

-- Accessible only using the isolated Worker's service key. Transactional claim:
-- every due row is leased at most once, and stale ambiguous attempts become
-- 'uncertain' rather than risking an automated duplicate.
create function public.claim_due_instagram_publish_job()
returns table(job_id uuid, post_id uuid, phase text, instagram_user_id text,
  encrypted_access_token text, storage_path text, caption text, creation_id text)
language plpgsql security invoker set search_path = '' as $$
declare j public.instagram_publish_jobs;
begin
  update public.instagram_publish_jobs set status='uncertain',
    reason_code='worker_interrupted',updated_at=clock_timestamp()
    where status in ('processing','publishing')
      and lease_at < clock_timestamp()-interval '5 minutes';

  select q.* into j from public.instagram_publish_jobs q
    join public.posts p on p.id=q.post_id
    join public.clients c on c.id=q.client_id
    join public.instagram_connections a on a.id=q.connection_id
    where q.status in ('queued','prepared') and q.scheduled_for <= clock_timestamp()
      and q.attempts < 30 and p.status='scheduled' and p.content_revision=q.content_revision
      and c.status='active' and not c.churned and a.token_expires_at>clock_timestamp()
    order by q.scheduled_for,q.id for update of q skip locked limit 1;
  if not found then return; end if;

  update public.instagram_publish_jobs set
    status='processing',attempts=attempts+1,lease_at=clock_timestamp(),
    updated_at=clock_timestamp()
    where id=j.id;
  return query select j.id,j.post_id,
    case when j.creation_id is null then 'create' else 'check' end,
    a.instagram_user_id,a.encrypted_access_token,f.storage_path,p.caption,j.creation_id
    from public.posts p
    join public.instagram_connections a on a.id=j.connection_id
    join public.post_files f on f.post_id=j.post_id
    where p.id=j.post_id and p.status='scheduled'
      and p.content_revision=j.content_revision and f.mime_type in ('image/jpeg','image/jpg')
    order by f.sort_order,f.id limit 1;
end $$;
revoke all on function public.claim_due_instagram_publish_job() from public, anon, authenticated;
grant execute on function public.claim_due_instagram_publish_job() to service_role;
-- No user may modify the job directly. The Worker writes only by service key.

-- Prevent edits while API publishing is in flight. Other posts retain all
-- existing editor, drag-and-drop, review and calendar behaviors.
create function public.guard_inflight_instagram_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.instagram_publish_jobs j where j.post_id=old.id
      and j.status in ('processing','publishing')) and
     (new.status,new.scheduled_date,new.scheduled_time,new.caption,
      new.social_networks,new.content_revision,new.format) is distinct from
     (old.status,old.scheduled_date,old.scheduled_time,old.caption,
      old.social_networks,old.content_revision,old.format)
  then
    raise exception 'Publicação sendo enviada ao Instagram. Aguarde a confirmação.'
      using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function public.guard_inflight_instagram_post() from public, anon, authenticated, service_role;
create trigger aab_guard_inflight_instagram before update on public.posts
for each row execute function public.guard_inflight_instagram_post();
-- Existing legacy auto_publish_scheduled_posts() must remain disabled:
-- it merely changed database status without contacting Instagram.
) into media_count,jpeg_count
    from public.post_files where post_id=p.id;

  select not exists(select 1 from public.post_approvals a where a.post_id=p.id)
    or exists(select 1 from public.post_approvals a where a.post_id=p.id
      and a.decision='approved' and a.reviewed_revision=p.content_revision)
    into is_approved;
  if p.scheduled_date is not null and p.scheduled_time is not null then
    scheduled := (p.scheduled_date + p.scheduled_time) at time zone 'America/Sao_Paulo';
  end if;
  reason := case
    when not coalesce(active_client,false) then 'inactive_client'
    when scheduled is null then 'missing_date_time'
    when scheduled <= clock_timestamp() then 'past_schedule'
    when matching=0 then 'account_not_connected'
    when matching>1 then 'multiple_accounts'
    when not is_approved then 'awaiting_approval'
    when p.format is distinct from 'Feed' then 'unsupported_format'
    when media_count<>1 or jpeg_count<>1 then 'single_jpeg_required'
    when nullif(trim(coalesce(p.caption,'')),'') is null then 'caption_required'
    else null
  end;

  insert into public.instagram_publish_jobs(
    post_id,client_id,connection_id,content_revision,scheduled_for,status,reason_code,updated_at)
  values (p.id,p.client_id,case when matching=1 then connected else null end,
    p.content_revision,scheduled,case when reason is null then 'queued' else 'blocked' end,reason,clock_timestamp())
  on conflict (post_id) do update set
    client_id=excluded.client_id,connection_id=excluded.connection_id,
    content_revision=excluded.content_revision,scheduled_for=excluded.scheduled_for,
    status=excluded.status,reason_code=excluded.reason_code,
    creation_id=null,published_media_id=null,attempts=0,lease_at=null,
    published_at=null,updated_at=clock_timestamp()
  where public.instagram_publish_jobs.status not in ('processing','publishing','published','uncertain');
  return null;
end $$;
revoke all on function public.sync_instagram_publish_job() from public, anon, authenticated, service_role;
create trigger zzz_sync_instagram_publish_job after insert or update
  on public.posts for each row execute function public.sync_instagram_publish_job();
-- The existing media revision trigger updates posts and therefore also refreshes
-- the publication queue, invalidating an approval when the media changes.

-- Accessible only using the isolated Worker's service key. Transactional claim:
-- every due row is leased at most once, and stale ambiguous attempts become
-- 'uncertain' rather than risking an automated duplicate.
create function public.claim_due_instagram_publish_job()
returns table(job_id uuid, post_id uuid, phase text, instagram_user_id text,
  encrypted_access_token text, storage_path text, caption text, creation_id text)
language plpgsql security invoker set search_path = '' as $$
declare j public.instagram_publish_jobs;
begin
  update public.instagram_publish_jobs set status='uncertain',
    reason_code='worker_interrupted',updated_at=clock_timestamp()
    where status in ('processing','publishing')
      and lease_at < clock_timestamp()-interval '5 minutes';

  select q.* into j from public.instagram_publish_jobs q
    join public.posts p on p.id=q.post_id
    join public.clients c on c.id=q.client_id
    join public.instagram_connections a on a.id=q.connection_id
    where q.status in ('queued','prepared') and q.scheduled_for <= clock_timestamp()
      and q.attempts < 30 and p.status='scheduled' and p.content_revision=q.content_revision
      and c.status='active' and not c.churned and a.token_expires_at>clock_timestamp()
    order by q.scheduled_for,q.id for update of q skip locked limit 1;
  if not found then return; end if;

  update public.instagram_publish_jobs set
    status='processing',attempts=attempts+1,lease_at=clock_timestamp(),
    updated_at=clock_timestamp()
    where id=j.id;
  return query select j.id,j.post_id,
    case when j.creation_id is null then 'create' else 'check' end,
    a.instagram_user_id,a.encrypted_access_token,f.storage_path,p.caption,j.creation_id
    from public.posts p
    join public.instagram_connections a on a.id=j.connection_id
    join public.post_files f on f.post_id=j.post_id
    where p.id=j.post_id and p.status='scheduled'
      and p.content_revision=j.content_revision and f.mime_type in ('image/jpeg','image/jpg')
    order by f.sort_order,f.id limit 1;
end $$;
revoke all on function public.claim_due_instagram_publish_job() from public, anon, authenticated;
grant execute on function public.claim_due_instagram_publish_job() to service_role;
-- No user may modify the job directly. The Worker writes only by service key.

-- Prevent edits while API publishing is in flight. Other posts retain all
-- existing editor, drag-and-drop, review and calendar behaviors.
create function public.guard_inflight_instagram_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.instagram_publish_jobs j where j.post_id=old.id
      and j.status in ('processing','publishing')) and
     (new.status,new.scheduled_date,new.scheduled_time,new.caption,
      new.social_networks,new.content_revision,new.format) is distinct from
     (old.status,old.scheduled_date,old.scheduled_time,old.caption,
      old.social_networks,old.content_revision,old.format)
  then
    raise exception 'Publicação sendo enviada ao Instagram. Aguarde a confirmação.'
      using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function public.guard_inflight_instagram_post() from public, anon, authenticated, service_role;
create trigger aab_guard_inflight_instagram before update on public.posts
for each row execute function public.guard_inflight_instagram_post();
-- Existing legacy auto_publish_scheduled_posts() must remain disabled:
-- it merely changed database status without contacting Instagram.
