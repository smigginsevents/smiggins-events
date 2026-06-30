-- Add media_fullscreen toggle to live state
-- Host can expand an image to fill the TV screen during a question
ALTER TABLE trivia_live_state ADD COLUMN IF NOT EXISTS media_fullscreen BOOLEAN DEFAULT FALSE;
