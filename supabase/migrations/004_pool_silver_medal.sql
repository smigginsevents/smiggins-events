-- Silver medal playoff support for 3-finalist knockout scenarios
-- Run in: Supabase Dashboard → SQL Editor

alter table pool_matches
  add column if not exists is_silver_match boolean not null default false;

alter table pool_tournaments
  add column if not exists silver_winner_id uuid references pool_players(id);
