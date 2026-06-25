-- ============================================================
-- Smiggins Events Platform — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Shared ──────────────────────────────────────────────────────────────────

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);

-- ─── Trivia ──────────────────────────────────────────────────────────────────

create table if not exists trivia_events (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null default '4 Pines Trivia Night',
  event_date                  date not null,
  status                      text not null default 'draft'
                              check (status in ('draft','ready','live','complete')),
  default_time_limit_seconds  int not null default 30,
  created_at                  timestamptz default now()
);

create table if not exists trivia_rounds (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid references trivia_events(id) on delete cascade,
  round_number        int not null,
  name                text not null,
  time_limit_seconds  int,
  unique(event_id, round_number)
);

create table if not exists trivia_questions (
  id                    uuid primary key default gen_random_uuid(),
  round_id              uuid references trivia_rounds(id) on delete cascade,
  question_number       int not null,
  question_text         text not null,
  answer_text           text not null,
  media_type            text not null default 'none'
                        check (media_type in ('none','image','video','audio')),
  media_url             text,
  media_storage_path    text,
  points                int not null default 1,
  unique(round_id, question_number)
);

create table if not exists trivia_event_teams (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references trivia_events(id) on delete cascade,
  team_id   uuid references teams(id),
  unique(event_id, team_id)
);

create table if not exists trivia_scores (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references trivia_events(id) on delete cascade,
  round_id  uuid references trivia_rounds(id),
  team_id   uuid references teams(id),
  points    numeric not null default 0,
  unique(event_id, round_id, team_id)
);

-- Single live-state row per event — control panel writes, display subscribes
create table if not exists trivia_live_state (
  event_id              uuid primary key references trivia_events(id) on delete cascade,
  current_round_id      uuid references trivia_rounds(id),
  current_question_id   uuid references trivia_questions(id),
  phase                 text not null default 'lobby'
                        check (phase in (
                          'lobby','round_intro','question','timer_running',
                          'answer_reveal','round_leaderboard','final_reveal','complete'
                        )),
  timer_started_at      timestamptz,
  leaderboard_revealed  boolean default false,
  updated_at            timestamptz default now()
);

-- ─── Pool Comp ───────────────────────────────────────────────────────────────

create table if not exists pool_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Monday Night Pool Comp',
  event_date  date not null,
  status      text not null default 'draft'
              check (status in ('draft','live','complete'))
);

create table if not exists pool_scores (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references pool_events(id) on delete cascade,
  team_id   uuid references teams(id),
  points    numeric not null default 0,
  unique(event_id, team_id)
);

-- ─── Public view — answer_text excluded ──────────────────────────────────────
-- The display screen only ever touches this view, never the base table directly

create or replace view trivia_questions_public as
  select
    id,
    round_id,
    question_number,
    question_text,
    media_type,
    media_url,
    media_storage_path,
    points
  from trivia_questions;

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table teams               enable row level security;
alter table trivia_events       enable row level security;
alter table trivia_rounds       enable row level security;
alter table trivia_questions    enable row level security;
alter table trivia_event_teams  enable row level security;
alter table trivia_scores       enable row level security;
alter table trivia_live_state   enable row level security;
alter table pool_events         enable row level security;
alter table pool_scores         enable row level security;

-- anon: read non-draft trivia events
create policy "anon read trivia_events" on trivia_events
  for select to anon
  using (status != 'draft');

-- anon: read rounds of non-draft events
create policy "anon read trivia_rounds" on trivia_rounds
  for select to anon
  using (
    exists (
      select 1 from trivia_events e
      where e.id = trivia_rounds.event_id and e.status != 'draft'
    )
  );

-- anon: read trivia_event_teams
create policy "anon read trivia_event_teams" on trivia_event_teams
  for select to anon using (true);

-- anon: read trivia_scores
create policy "anon read trivia_scores" on trivia_scores
  for select to anon using (true);

-- anon: read live state (for display screen)
create policy "anon read trivia_live_state" on trivia_live_state
  for select to anon using (true);

-- anon: read teams
create policy "anon read teams" on teams
  for select to anon using (true);

-- anon: read pool events (non-draft)
create policy "anon read pool_events" on pool_events
  for select to anon
  using (status != 'draft');

-- anon: read pool scores
create policy "anon read pool_scores" on pool_scores
  for select to anon using (true);

-- authenticated (host): full access to everything
create policy "host full access teams" on teams
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_events" on trivia_events
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_rounds" on trivia_rounds
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_questions" on trivia_questions
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_event_teams" on trivia_event_teams
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_scores" on trivia_scores
  for all to authenticated using (true) with check (true);

create policy "host full access trivia_live_state" on trivia_live_state
  for all to authenticated using (true) with check (true);

create policy "host full access pool_events" on pool_events
  for all to authenticated using (true) with check (true);

create policy "host full access pool_scores" on pool_scores
  for all to authenticated using (true) with check (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- After running this SQL, also enable Realtime on trivia_live_state in:
-- Supabase Dashboard → Database → Replication → Tables → trivia_live_state

-- ─── Storage ──────────────────────────────────────────────────────────────────
-- Create a "trivia-media" bucket in Supabase Dashboard → Storage
-- Set it to PUBLIC with a 10MB max file size
-- Policy: anyone can read, only authenticated can upload/delete
