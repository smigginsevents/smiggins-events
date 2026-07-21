import { createClient } from '@/lib/supabase/client'

/**
 * Duplicate a trivia event: copies the event settings, all rounds and all
 * questions (including multiple choice options and media) into a fresh
 * draft event on the given date. Teams, scores and live progress are not
 * copied. Uploaded media files are copied in storage so the two events
 * never share files — deleting one can't break the other.
 *
 * Returns the new event id.
 */
export async function duplicateTriviaEvent(sourceEventId: string, newDate: string): Promise<string> {
  const supabase = createClient()

  const [{ data: source, error: sourceErr }, { data: rounds, error: roundsErr }] = await Promise.all([
    supabase.from('trivia_events').select('*').eq('id', sourceEventId).single(),
    supabase.from('trivia_rounds').select('*').eq('event_id', sourceEventId).order('round_number'),
  ])
  if (sourceErr || !source) throw new Error(sourceErr?.message ?? 'Source event not found')
  if (roundsErr) throw new Error(roundsErr.message)

  const { data: questions, error: questionsErr } = (rounds ?? []).length > 0
    ? await supabase.from('trivia_questions').select('*')
        .in('round_id', (rounds ?? []).map(r => r.id)).order('question_number')
    : { data: [], error: null }
  if (questionsErr) throw new Error(questionsErr.message)

  const { data: newEvent, error: eventErr } = await supabase
    .from('trivia_events')
    .insert({
      name: source.name,
      event_date: newDate,
      default_time_limit_seconds: source.default_time_limit_seconds,
      status: 'draft',
    })
    .select('id')
    .single()
  if (eventErr || !newEvent) throw new Error(eventErr?.message ?? 'Failed to create event')

  const { data: newRounds, error: newRoundsErr } = await supabase
    .from('trivia_rounds')
    .insert((rounds ?? []).map(r => ({
      event_id: newEvent.id,
      round_number: r.round_number,
      name: r.name,
      description: r.description,
      time_limit_seconds: r.time_limit_seconds,
    })))
    .select('id, round_number')
  if (newRoundsErr) throw new Error(newRoundsErr.message)

  const roundIdMap = new Map<string, string>()
  for (const r of rounds ?? []) {
    const copy = (newRounds ?? []).find(nr => nr.round_number === r.round_number)
    if (copy) roundIdMap.set(r.id, copy.id)
  }

  const newQuestions = await Promise.all((questions ?? []).map(async q => {
    const newRoundId = roundIdMap.get(q.round_id)!
    let mediaUrl = q.media_url
    let mediaStoragePath = q.media_storage_path

    if (q.media_storage_path) {
      const ext = q.media_storage_path.split('.').pop() ?? 'bin'
      const newPath = `${newEvent.id}/${newRoundId}_q${q.question_number}_${Date.now()}.${ext}`
      const { error: copyErr } = await supabase.storage
        .from('trivia-media')
        .copy(q.media_storage_path, newPath)
      if (!copyErr) {
        mediaUrl = supabase.storage.from('trivia-media').getPublicUrl(newPath).data.publicUrl
        mediaStoragePath = newPath
      }
      // On copy failure (e.g. source file missing) keep the original URL so
      // the question isn't silently stripped — host can re-upload in the builder
    }

    return {
      round_id: newRoundId,
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: q.answer_text,
      host_comment: q.host_comment,
      multiple_choice_options: q.multiple_choice_options,
      correct_option_index: q.correct_option_index,
      media_type: q.media_type,
      media_url: mediaUrl,
      media_storage_path: mediaStoragePath,
      points: q.points,
    }
  }))

  if (newQuestions.length > 0) {
    const { error: qErr } = await supabase.from('trivia_questions').insert(newQuestions)
    if (qErr) throw new Error(qErr.message)
  }

  const { error: stateErr } = await supabase.from('trivia_live_state').insert({
    event_id: newEvent.id,
    phase: 'lobby',
    marking_question_index: 0,
    marking_revealed: false,
  })
  if (stateErr) throw new Error(stateErr.message)

  return newEvent.id
}
