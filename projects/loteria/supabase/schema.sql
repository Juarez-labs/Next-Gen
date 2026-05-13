-- Lotería app schema.
-- Run this in the Supabase SQL editor (or `supabase db push` if using the CLI).

-- ============================================================
-- profiles: mirror of auth.users with display info
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador',
  avatar_emoji text not null default '🎉',
  locale text not null default 'es',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by authed users"
  on public.profiles for select
  to authenticated using (true);

create policy "profiles updatable by owner"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

create policy "profiles insertable by owner"
  on public.profiles for insert
  to authenticated with check (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Jugador'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- games
-- ============================================================
create type game_status as enum ('lobby', 'playing', 'finished');
create type win_mode as enum ('corners', 'row', 'full');

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  status game_status not null default 'lobby',
  win_mode win_mode not null default 'full',
  tempo_ms integer not null default 5000,
  call_order integer[] not null default '{}',     -- shuffled card indices, set at start
  current_call_index integer not null default 0,  -- how many cards have been called
  false_claim_penalty boolean not null default true,
  winner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.games enable row level security;

create policy "games readable by anyone authed (lobby discovery via code)"
  on public.games for select
  to authenticated using (true);

create policy "games insertable by host"
  on public.games for insert
  to authenticated with check (auth.uid() = host_id);

create policy "games updatable by host"
  on public.games for update
  to authenticated using (auth.uid() = host_id);

-- ============================================================
-- game_players: a player's tabla and marks for a specific game
-- ============================================================
create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tabla integer[] not null,            -- length 16
  marks boolean[] not null default array_fill(false, array[16]),
  out_for_round boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.game_players enable row level security;

create policy "players readable if in same game"
  on public.game_players for select
  to authenticated using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = game_players.game_id
        and gp.user_id = auth.uid()
    )
  );

create policy "players insert self"
  on public.game_players for insert
  to authenticated with check (auth.uid() = user_id);

create policy "players update own marks"
  on public.game_players for update
  to authenticated using (auth.uid() = user_id);

-- ============================================================
-- custom_cards: per-user card art overrides
-- ============================================================
create table if not exists public.custom_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_index integer not null check (card_index between 0 and 53),
  image_url text not null,
  source text not null check (source in ('photo', 'ai')),
  prompt text,
  created_at timestamptz not null default now(),
  primary key (user_id, card_index)
);

alter table public.custom_cards enable row level security;

create policy "custom_cards readable by owner"
  on public.custom_cards for select
  to authenticated using (auth.uid() = user_id);

create policy "custom_cards writable by owner"
  on public.custom_cards for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- realtime
-- ============================================================
-- Enable realtime on the tables clients subscribe to.
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
