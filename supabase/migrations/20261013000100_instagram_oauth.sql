-- Instagram OAuth connections are private to the initiating RSM user.
-- No client-level publishing is enabled by this migration.
create table if not exists public.instagram_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, instagram_user_id)
);
alter table public.instagram_oauth_states enable row level security;
alter table public.instagram_connections enable row level security;
-- No anon/authenticated policies. Access only via privileged server functions.
revoke all on public.instagram_oauth_states from anon, authenticated;
revoke all on public.instagram_connections from anon, authenticated;
