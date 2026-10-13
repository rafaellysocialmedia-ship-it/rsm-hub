-- Match the existing create action and legacy role fallback; do not invent a new role.
create function public.can_create_calendar() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (
 public.has_role(auth.uid(),'administrator') or (
 public.has_role(auth.uid(),'team') and
 (not exists(select 1 from public.my_permissions()) or public.user_has_permission(auth.uid(),'social.calendar','create')) and
 not exists(select 1 from public.module_visibility where not visible and module_key in ('social.calendar','social'))));
$$;
revoke all on function public.can_create_calendar() from public,anon;
grant execute on function public.can_create_calendar() to authenticated;
create policy calendar_create_permission on public.posts as restrictive for insert to authenticated with check(public.can_create_calendar());
