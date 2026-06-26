-- ============================================================
-- Smiggins Pool Knockout System — Migration 002
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Players (individuals, distinct from team-based trivia teams) ─────────────

create table if not exists pool_players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);

-- ─── Tournaments (each Monday night knockout) ─────────────────────────────────

create table if not exists pool_tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Monday Pool Comp',
  event_date  date not null default current_date,
  status      text not null default 'setup'
              check (status in ('setup', 'active', 'complete')),
  created_at  timestamptz default now()
);

-- ─── Tournament Entries ───────────────────────────────────────────────────────

create table if not exists pool_tournament_entries (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references pool_tournaments(id) on delete cascade,
  player_id      uuid not null references pool_players(id) on delete cascade,
  draw_order     int,
  unique(tournament_id, player_id)
);

-- ─── Matches ──────────────────────────────────────────────────────────────────

create table if not exists pool_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references pool_tournaments(id) on delete cascade,
  round_number   int  not null,
  match_number   int  not null,  -- sequential across the whole tournament
  table_number   int  not null check (table_number in (1, 2)),
  player1_id     uuid references pool_players(id),
  player2_id     uuid references pool_players(id),
  is_bye         boolean not null default false,
  winner_id      uuid references pool_players(id),
  status         text not null default 'pending'
                 check (status in ('pending', 'active', 'complete')),
  created_at     timestamptz default now(),
  unique(tournament_id, match_number)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table pool_players             enable row level security;
alter table pool_tournaments         enable row level security;
alter table pool_tournament_entries  enable row level security;
alter table pool_matches             enable row level security;

-- Public read
create policy "public read pool_players"            on pool_players            for select using (true);
create policy "public read pool_tournaments"         on pool_tournaments         for select using (true);
create policy "public read pool_tournament_entries"  on pool_tournament_entries  for select using (true);
create policy "public read pool_matches"             on pool_matches             for select using (true);

-- Authenticated (host) write
create policy "host write pool_players"            on pool_players            for all using (auth.uid() is not null);
create policy "host write pool_tournaments"         on pool_tournaments         for all using (auth.uid() is not null);
create policy "host write pool_tournament_entries"  on pool_tournament_entries  for all using (auth.uid() is not null);
create policy "host write pool_matches"             on pool_matches             for all using (auth.uid() is not null);
