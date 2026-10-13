-- Additive migration: legacy unassigned connections remain private and untouched.
alter table public.instagram_oauth_states
  add column client_id uuid references public.clients(id) on delete cascade,
  add column browser_hash text;
alter table public.instagram_connections
  add column client_id uuid references public.clients(id) on delete cascade;
alter table public.instagram_connections drop constraint instagram_connections_user_id_instagram_user_id_key;
alter table public.instagram_connections add constraint instagram_connections_client_account_key unique (client_id, instagram_user_id);
create index instagram_oauth_states_expiry_idx on public.instagram_oauth_states(expires_at);
create index instagram_oauth_states_client_idx on public.instagram_oauth_states(client_id);
-- Keep tokens and state inaccessible even if project default grants change.
revoke all on public.instagram_oauth_states, public.instagram_connections from public, anon, authenticated;
grant select, insert, update, delete on public.instagram_oauth_states, public.instagram_connections to service_role;

-- Service-only authorization query. No SECURITY DEFINER; never trusts user_metadata.
-- Mirrors usePermissions('workspace.clients','edit') plus legacy staff and client eligibility.
create function public.can_manage_instagram(_user_id uuid, _client_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  with recursive module_chain as (
    select key, parent_key, array[key] as visited from public.app_modules where key = 'workspace.clients'
    union all
    select m.key, m.parent_key, c.visited || m.key from public.app_modules m
    join module_chain c on m.key = c.parent_key where not m.key = any(c.visited)
  ), roles as (
    select role::text from public.user_roles where user_id = _user_id
  ), permissions as (
    select p.module_key, p.action from public.user_app_roles ur
    join public.app_role_permissions rp on rp.role_key = ur.role_key
    join public.app_permissions p on p.id = rp.permission_id where ur.user_id = _user_id
  )
  select _user_id is not null and exists (
    select 1 from public.clients c where c.id = _client_id and not coalesce(c.churned, false) and c.status <> 'inactive'
  ) and (
    exists(select 1 from roles where role = 'administrator') or (
      exists(select 1 from roles where role = 'team') and (
        not exists(select 1 from permissions) or
        not exists(select 1 from public.app_modules where key = 'workspace.clients') or
        exists(select 1 from permissions where module_key = 'workspace.clients' and action = 'edit')
      ) and not exists (
        select 1 from public.module_visibility v where not v.visible
        and (v.module_key = 'workspace.clients' or v.module_key in (select key from module_chain))
        and ((v.scope = 'user' and v.scope_id = _user_id::text)
          or (v.scope = 'role' and v.scope_id in (select role from roles))
          or (v.scope = 'client' and exists(select 1 from public.clients c where c.user_id = _user_id and c.id::text = v.scope_id)))
      )
    )
  );
$$;
revoke all on function public.can_manage_instagram(uuid,uuid) from public, anon, authenticated;
grant execute on function public.can_manage_instagram(uuid,uuid) to service_role;
