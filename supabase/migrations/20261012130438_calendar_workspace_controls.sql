-- Reuse the user's navigation preference record and the current module permission model.
alter table public.navigation_preferences add column calendar_density text not null default 'standard' check(calendar_density in ('compact','standard','expanded'));
alter table public.navigation_preferences add column calendar_filters_open boolean not null default true;
alter table public.post_files add column sort_order integer not null default 0;
create function public.can_edit_calendar() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (
 public.has_role(auth.uid(),'administrator') or (
 public.has_role(auth.uid(),'team') and
 (not exists(select 1 from public.my_permissions()) or public.user_has_permission(auth.uid(),'social.calendar','edit')) and
 not exists(select 1 from public.module_visibility where not visible and module_key in ('social.calendar','social'))));
$$;
revoke all on function public.can_edit_calendar() from public,anon;
grant execute on function public.can_edit_calendar() to authenticated;
create policy calendar_edit_permission on public.posts as restrictive for update to authenticated using(public.can_edit_calendar()) with check(public.can_edit_calendar());
create policy calendar_media_insert_permission on public.post_files as restrictive for insert to authenticated with check(public.can_edit_calendar());
create policy calendar_media_update_permission on public.post_files as restrictive for update to authenticated using(public.can_edit_calendar()) with check(public.can_edit_calendar());
create policy calendar_media_delete_permission on public.post_files as restrictive for delete to authenticated using(public.can_edit_calendar());
create policy calendar_upload_permission on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'post-files' or public.can_edit_calendar());

-- Date and time remain wall-clock values in the existing workspace timezone.
create function public.calendar_timezone() returns text language sql stable security invoker set search_path='' as $$select coalesce((select timezone from public.workspace_settings where id=1),'America/Fortaleza')$$;
revoke all on function public.calendar_timezone() from public,anon;
grant execute on function public.calendar_timezone() to authenticated;

-- Audit existing records without trusting browser-supplied authors or previous values.
create table public.post_schedule_events(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,client_id uuid references public.clients(id),actor_id uuid references auth.users(id),previous_date date,previous_time time,new_date date,new_time time,timezone text not null,created_at timestamptz not null default clock_timestamp());
alter table public.post_schedule_events enable row level security;
revoke all on public.post_schedule_events from authenticated;
grant select on public.post_schedule_events to authenticated;
revoke all on public.post_schedule_events from anon;
create policy schedule_events_read on public.post_schedule_events for select to authenticated using(public.has_role(auth.uid(),'administrator') or public.has_role(auth.uid(),'team') or public.can_access_portal_post(post_id,'can_view_history'));
create function rsm_private.audit_post_schedule() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.scheduled_date,new.scheduled_time) is distinct from (old.scheduled_date,old.scheduled_time) then
 insert into public.post_schedule_events(post_id,client_id,actor_id,previous_date,previous_time,new_date,new_time,timezone) values(new.id,new.client_id,auth.uid(),old.scheduled_date,old.scheduled_time,new.scheduled_date,new.scheduled_time,coalesce((select timezone from public.workspace_settings where id=1),'America/Fortaleza'));
 end if;return new;end$$;
revoke all on function rsm_private.audit_post_schedule() from public,anon,authenticated;
create trigger audit_calendar_schedule after update on public.posts for each row execute function rsm_private.audit_post_schedule();

create function public.guard_calendar_schedule() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if (new.scheduled_date,new.scheduled_time) is distinct from (old.scheduled_date,old.scheduled_time) then
 if old.status='published' then raise exception 'Publicações já publicadas não podem ser reagendadas';end if;
 if old.publication_source is not null and old.publication_source<>'manual' then raise exception 'Agendamento externo: altere no provedor. A integração de reagendamento ainda não está disponível';end if;
 if new.scheduled_date is not null and new.scheduled_date<(now() at time zone public.calendar_timezone())::date then raise exception 'Escolha hoje ou uma data futura no fuso da conta';end if;
 end if;return new;end$$;
revoke all on function public.guard_calendar_schedule() from public,anon;
grant execute on function public.guard_calendar_schedule() to authenticated;
create trigger aab_calendar_schedule before update on public.posts for each row execute function public.guard_calendar_schedule();

create function public.save_calendar_post(_post_id uuid,_expected_updated_at timestamptz,_patch jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.posts; n public.posts;begin
 if not public.can_edit_calendar() then raise exception 'Sem permissão para editar publicações' using errcode='42501';end if;
 select * into p from public.posts where id=_post_id for update;
 if not found then raise exception 'Publicação indisponível';end if;
 if p.updated_at is distinct from _expected_updated_at then raise exception 'Conflito: outra alteração foi salva. Seu rascunho foi mantido. Consulte a versão atual antes de salvar' using errcode='40001';end if;
 if _patch ? 'client_id' and (_patch->>'client_id')::uuid is distinct from p.client_id then raise exception 'O editor permanece vinculado à conta original';end if;
 if exists(select 1 from jsonb_object_keys(_patch) k where k not in ('title','caption','headline','subheadline','script','slides','cta','hashtags','social_network','social_networks','format','objective','theme','pillar','status','recurrence','scheduled_date','scheduled_time','extra_request_id','client_id')) then raise exception 'Campo não permitido';end if;
 n:=jsonb_populate_record(p,_patch);
 if nullif(trim(n.title),'') is null then raise exception 'Título obrigatório';end if;
 update public.posts set title=n.title,caption=n.caption,headline=n.headline,subheadline=n.subheadline,script=n.script,slides=n.slides,cta=n.cta,hashtags=n.hashtags,social_network=n.social_network,social_networks=n.social_networks,format=n.format,objective=n.objective,theme=n.theme,pillar=n.pillar,status=n.status,recurrence=n.recurrence,scheduled_date=n.scheduled_date,scheduled_time=n.scheduled_time,extra_request_id=n.extra_request_id where id=p.id returning * into n;
 return to_jsonb(n);end$$;
revoke all on function public.save_calendar_post(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.save_calendar_post(uuid,timestamptz,jsonb) to authenticated;

create function public.change_calendar_media(_post_id uuid,_expected_updated_at timestamptz,_action text,_file jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.posts; fid uuid;begin
 if not public.can_edit_calendar() then raise exception 'Sem permissão para editar mídias' using errcode='42501';end if;
 select * into p from public.posts where id=_post_id for update;
 if not found then raise exception 'Publicação indisponível';end if;
 if p.updated_at is distinct from _expected_updated_at then raise exception 'Conflito: a publicação mudou. Atualize a versão antes de alterar mídias' using errcode='40001';end if;
 if _action='attach' then
 if split_part(_file->>'storage_path','/',1)<>p.id::text or not exists(select 1 from storage.objects where bucket_id='post-files' and name=_file->>'storage_path') then raise exception 'Arquivo inválido para esta publicação';end if;
 insert into public.post_files(post_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,sort_order) values(p.id,_file->>'storage_path',_file->>'file_name',_file->>'mime_type',(_file->>'size_bytes')::bigint,auth.uid(),coalesce((select max(sort_order)+1 from public.post_files where post_id=p.id),0));
 elsif _action='remove' then
 delete from public.post_files where id=(_file->>'id')::uuid and post_id=p.id;
 if not found then raise exception 'Arquivo não encontrado';end if;
 elsif _action='order' then
 if jsonb_array_length(_file->'ids')<>(select count(*) from public.post_files where post_id=p.id) or (select count(distinct value) from jsonb_array_elements_text(_file->'ids'))<>jsonb_array_length(_file->'ids') or exists(select 1 from jsonb_array_elements_text(_file->'ids') x where not exists(select 1 from public.post_files where post_id=p.id and id=x.value::uuid)) then raise exception 'Lista de mídias inválida';end if;
 update public.post_files f set sort_order=x.ord::int from jsonb_array_elements_text(_file->'ids') with ordinality x(value,ord) where f.id=x.value::uuid and f.post_id=p.id;
 else raise exception 'Ação inválida';end if;
 select * into p from public.posts where id=_post_id;
 return to_jsonb(p);end$$;
revoke all on function public.change_calendar_media(uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function public.change_calendar_media(uuid,timestamptz,text,jsonb) to authenticated;

-- Stop the legacy clock-only job; it is not connected to an external publishing service.
select cron.alter_job(jobid,active:=false) from cron.job where command like '%auto_publish_scheduled_posts%';
