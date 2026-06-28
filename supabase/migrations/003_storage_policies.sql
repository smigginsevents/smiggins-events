-- ============================================================
-- Smiggins Events — Migration 003: Storage policies
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Before running: make sure the 'trivia-media' bucket exists.
-- Create it at: Storage → New bucket → name: trivia-media → Public → Save
-- ============================================================

-- Allow anyone to view uploaded trivia media (images/audio for the display screen)
create policy "Public read trivia-media"
  on storage.objects for select
  using (bucket_id = 'trivia-media');

-- Allow authenticated host to upload files
create policy "Host upload trivia-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trivia-media');

-- Allow authenticated host to replace / overwrite files
create policy "Host update trivia-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trivia-media');

-- Allow authenticated host to delete files (cleanup on question delete)
create policy "Host delete trivia-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'trivia-media');
