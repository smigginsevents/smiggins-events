'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { TriviaEvent, TriviaRound, TriviaQuestion, Team } from '@/lib/types'

interface CheckItem {
  id: string
  label: string
  check: () => boolean
}

export default function PreShowPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [event, setEvent] = useState<TriviaEvent | null>(null)
  const [rounds, setRounds] = useState<TriviaRound[]>([])
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: evt }, { data: rds }, { data: etRows }] = await Promise.all([
        supabase.from('trivia_events').select('*').eq('id', eventId).single(),
        supabase.from('trivia_rounds').select('*').eq('event_id', eventId).order('round_number'),
        supabase.from('trivia_event_teams')
          .select('team_id, teams(id,name,created_at)')
          .eq('event_id', eventId),
      ])
      setEvent(evt)
      setRounds(rds ?? [])
      setTeams((etRows ?? []).map((r: any) => r.teams).filter(Boolean))

      if (rds && rds.length > 0) {
        const roundIds = rds.map((r) => r.id)
        const { data: qs } = await supabase
          .from('trivia_questions')
          .select('*')
          .in('round_id', roundIds)
        setQuestions(qs ?? [])
      }
    }
    load()
  }, [eventId])

  const checks: CheckItem[] = [
    {
      id: 'rounds',
      label: `${rounds.length} round${rounds.length !== 1 ? 's' : ''} configured`,
      check: () => rounds.length > 0,
    },
    {
      id: 'questions',
      label: `All questions have text and answers (${questions.filter((q) => q.question_text && q.answer_text).length}/${questions.length})`,
      check: () =>
        questions.length > 0 &&
        questions.every((q) => q.question_text.trim() && q.answer_text.trim()),
    },
    {
      id: 'teams',
      label: `${teams.length} team${teams.length !== 1 ? 's' : ''} registered`,
      check: () => teams.length >= 2,
    },
  ]

  const allGreen = checks.every((c) => c.check())

  async function startEvent() {
    if (!allGreen) return
    setLaunching(true)

    const supabase = createClient()

    // Set status to live
    await supabase.from('trivia_events').update({ status: 'live' }).eq('id', eventId)

    // Ensure live state row exists and reset it
    await supabase.from('trivia_live_state').upsert({
      event_id: eventId,
      phase: 'lobby',
      current_round_id: null,
      current_question_id: null,
      timer_started_at: null,
      leaderboard_revealed: false,
      updated_at: new Date().toISOString(),
    })

    router.push(`/host/trivia/${eventId}/control`)
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div>
        <Link href={`/host/trivia/${eventId}/teams`} className="text-timber text-sm hover:text-navy">
          ← Teams
        </Link>
        <h1 className="text-2xl font-semibold text-navy mt-1">Pre-Show Checklist</h1>
        <p className="text-navy/50 text-sm">{event?.name}</p>
      </div>

      <Card>
        <ul className="flex flex-col gap-4">
          {checks.map((c) => {
            const ok = c.check()
            return (
              <li key={c.id} className="flex items-center gap-3">
                <span className={ok ? 'text-pine' : 'text-rust'}>
                  {ok ? '✓' : '✗'}
                </span>
                <span className={`text-sm ${ok ? 'text-navy' : 'text-navy/50'}`}>
                  {c.label}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Before Starting</h2>
        <ul className="text-sm text-navy/70 flex flex-col gap-2 list-disc list-inside">
          <li>Open <strong>/host/trivia/{eventId}/display</strong> in a separate window and drag it to the big screen</li>
          <li>Go fullscreen on the display window (F11 or View → Enter Full Screen)</li>
          <li>Keep this control window on your laptop display</li>
          <li>Check venue WiFi is stable on both windows</li>
        </ul>

        <div className="mt-4 flex gap-3">
          <a
            href={`/host/trivia/${eventId}/display`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="ghost" size="sm">Open Display Screen ↗</Button>
          </a>
        </div>
      </Card>

      <Button
        size="lg"
        onClick={startEvent}
        loading={launching}
        disabled={!allGreen}
        className="w-full"
      >
        Start Event
      </Button>

      {!allGreen && (
        <p className="text-sm text-navy/40 text-center">
          Fix the checklist items above to enable start.
        </p>
      )}
    </div>
  )
}
