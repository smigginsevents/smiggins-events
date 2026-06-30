-- ============================================================
-- Smiggins Trivia — Show Upgrade
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Round descriptions (subtitle shown on round intro screen)
ALTER TABLE trivia_rounds ADD COLUMN IF NOT EXISTS description TEXT;

-- Multiple choice support
ALTER TABLE trivia_questions ADD COLUMN IF NOT EXISTS multiple_choice_options JSONB;
ALTER TABLE trivia_questions ADD COLUMN IF NOT EXISTS correct_option_index INTEGER;

-- Marking + break state in live_state
ALTER TABLE trivia_live_state ADD COLUMN IF NOT EXISTS marking_question_index INTEGER DEFAULT 0;
ALTER TABLE trivia_live_state ADD COLUMN IF NOT EXISTS marking_revealed BOOLEAN DEFAULT FALSE;

-- Drop old phase constraint and add new one with all phases
ALTER TABLE trivia_live_state DROP CONSTRAINT IF EXISTS trivia_live_state_phase_check;
ALTER TABLE trivia_live_state ADD CONSTRAINT trivia_live_state_phase_check
  CHECK (phase IN (
    'lobby',
    'game_overview',
    'round_intro',
    'question',
    'timer_running',
    'answer_reveal',
    'round_end',
    'marking',
    'break',
    'round_leaderboard',
    'final_reveal',
    'complete'
  ));

-- Update public view to include multiple choice fields (answers still excluded)
-- Must drop first — CREATE OR REPLACE can't reorder or insert columns mid-list
DROP VIEW IF EXISTS trivia_questions_public;
CREATE VIEW trivia_questions_public AS
  SELECT
    id,
    round_id,
    question_number,
    question_text,
    multiple_choice_options,
    correct_option_index,
    media_type,
    media_url,
    media_storage_path,
    points
  FROM trivia_questions;

-- Add trivia_event_teams to realtime so the lobby display updates live as teams join
ALTER PUBLICATION supabase_realtime ADD TABLE trivia_event_teams;
