import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/trivia/answer?questionId=...
 *
 * Returns the answer for a question ONLY when the live_state for its event
 * is in the 'answer_reveal' phase. This prevents answers leaking to the
 * display screen before the host triggers reveal.
 */
export async function GET(request: NextRequest) {
  const questionId = request.nextUrl.searchParams.get('questionId')
  if (!questionId) {
    return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch the question (with answer)
  const { data: question, error } = await supabase
    .from('trivia_questions')
    .select('id, round_id, answer_text, trivia_rounds(event_id)')
    .eq('id', questionId)
    .single()

  if (error || !question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const eventId = (question as any).trivia_rounds?.event_id
  if (!eventId) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: liveState } = await supabase
    .from('trivia_live_state')
    .select('phase, current_question_id, marking_revealed')
    .eq('event_id', eventId)
    .single()

  if (!liveState) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Allow answer during normal answer_reveal OR during marking when host has revealed
  const isAnswerReveal = liveState.phase === 'answer_reveal' && liveState.current_question_id === questionId
  const isMarkingReveal = liveState.phase === 'marking' && liveState.marking_revealed === true

  if (!isAnswerReveal && !isMarkingReveal) {
    return NextResponse.json({ error: 'Answer not yet revealed' }, { status: 403 })
  }

  return NextResponse.json({ answer: question.answer_text })
}
