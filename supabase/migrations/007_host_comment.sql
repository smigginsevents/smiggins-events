-- ============================================================
-- Smiggins Trivia — Host Comment
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Host-only bonus knowledge shown during control/marking, never sent to players.
ALTER TABLE trivia_questions ADD COLUMN IF NOT EXISTS host_comment TEXT;

-- trivia_questions_public intentionally does NOT include host_comment —
-- it must never reach the audience-facing display screen.
