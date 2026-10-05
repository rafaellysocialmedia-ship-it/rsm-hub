create table public.navigation_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 sidebar_open boolean not null default true,
 favorites jsonb not null default '[]'::jsonb,
 constraint navigation_favorites_array check (jsonb_typeof(favorites)='array' and jsonb_array_length(favorites)<=50)
);
alter table public.navigation_preferences enable row level security;
create policy own_navigation_preferences on public.navigation_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.navigation_preferences from anon;
grant select,insert,update,delete on public.navigation_preferences to authenticated;
