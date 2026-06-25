'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLiveState, updateLiveState } from '@/lib/realtime'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type {
  TriviaLiveState,
  TriviaEvent,
  TriviaRound,
  TriviaQuestion,
  Team,
  LeaderboardEntry,
} from '@/lib/types'

export default function ControlPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [liveState, setLiveState] = useState<TriviaLiveState | null>(null)
  const [event, setEvent] = useState<TriviaEvent | null>(null)
  const [rounds, setRounds] = useState<TriviaRound[]>([])
  const [allQuestions, setAllQuestions] = useState<TriviaQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const computeLeaderboard = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trivia_scores')
      .select('team_id, points, teams(name)')
      .eq('event_id', eventId)

    if (!data) return []
    const totals: Record<string, { name: string; pts: number }> = {}
    for (const s of data as any[]) {
      if (!totals[s.team_id]) totals[s.team_id] = { name: s.teams?.name ?? '?', pts: 0 }
      totals[s.team_id].pts += Number(s.points)
    }
    const entries = Object.entries(totals)
      .sort(([, a], [, b]) => b.pts - a.pts)
      .map(([id, val], i) => ({ team_id: id, team_name: val.name, total_points: val.pts, rank: i + 1 }))
    setLeaderboard(entries)
    return entries
  }, [eventId])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: evt }, { data: rds }, { data: state }, { data: etRows }] = await Promise.all([
        supabase.from('trivia_events').select('*').eq('id', eventId).single(),
        supabase.from('trivia_rounds').select('*').eq('event_id', eventId).order('round_number'),
        supabase.from('trivia_live_state').select('*').eq('event_id', eventId).single(),
        supabase.from('trivia_event_teams').select('team_id, teams(id,name,created_at)').eq('event_id', eventId),
      ])
      setEvent(evt)
      setRounds(rds ?? [])
      setLiveState(state)
      setTeams((etRows ?? []).map((r: any) => r.teams).filter(Boolean))

      if (rds && rds.length > 0) {
        const { data: qs } = await supabase
          .from('trivia_questions')
          .select('*')
          .in('round_id', rds.map((r) => r.id))
          .order('question_number')
        setAllQuestions(qs ?? [])
      }
      setLoading(false)
    }
    load()
    computeLeaderboard()
  }, [eventId, computeLeaderboard])

  // Keep local state in sync with realtime
  useLiveState(eventId, (newState) => {
    setLiveState(newState)
    computeLeaderboard()
  })

  const currentRound = rounds.find((r) => r.id === liveState?.current_round_id)
  const roundQuestions = currentRound
    ? allQuestions.filter((q) => q.round_id === currentRound.id)
    : []
  const currentQuestion = allQuestions.find((q) => q.id === liveState?.current_question_id)
  const timerDuration = currentRound?.time_limit_seconds ?? event?.default_time_limit_seconds ?? 30

  async function act(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  // ── Phase transitions ───────────────────────────────────────────

  async function startRound(round: TriviaRound) {
    await act(() =>
      updateLiveState(eventId, {
        current_round_id: round.id,
        current_question_id: null,
        phase: 'round_intro',
        timer_started_at: null,
        leaderboard_revealed: false,
      })
    )
  }

  async function showQuestion(question: TriviaQuestion) {
    await act(() =>
      updateLiveState(eventId, {
        current_question_id: question.id,
        phase: 'question',
        timer_started_at: null,
      })
    )
  }

  async function startTimer() {
    await act(() =>
      updateLiveState(eventId, {
        phase: 'timer_running',
        timer_started_at: new Date().toISOString(),
      })
    )
  }

  async function revealAnswer() {
    await act(() =>
      updateLiveState(eventId, {
        phase: 'answer_reveal',
        timer_started_at: null,
      })
    )
  }

  async function showRoundLeaderboard() {
    await act(() =>
      updateLiveState(eventId, {
        phase: 'round_leaderboard',
        leaderboard_revealed: true,
      })
    )
  }

  async function showFinalReveal() {
    await act(() =>
      updateLiveState(eventId, { phase: 'final_reveal' })
    )
  }

  async function endEvent() {
    if (!confirm('End the event and return to lobby?')) return
    const supabase = createClient()
    await supabase.from('trivia_events').update({ status: 'complete' }).eq('id', eventId)
    await updateLiveState(eventId, { phase: 'complete' })
    router.push('/host')
  }

  // Score entry
  async function saveScore(teamId: string, roundId: string, pts: number) {
    const supabase = createClient()
    await supabase.from('trivia_scores').upsert(
      { event_id: eventId, round_id: roundId, team_id: teamId, points: pts },
      { onConflict: 'event_id,round_id,team_id' }
    )
    computeLeaderboard()
  }

  const isLastRound = currentRound?.round_number === rounds.length
  const currentQIdx = roundQuestions.findIndex((q) => q.id === liveState?.current_question_id)
  const isLastQuestion = currentQIdx === roundQuestions.length - 1

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-navy/40 text-sm">Loading control panel…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy">{event?.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="live">LIVE</Badge>
            <span className="text-navy/50 text-sm font-mono capitalize">{liveState?.phase?.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={`/host/trivia/${eventId}/display`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">Display Screen ↗</Button>
          </a>
          <Button variant="danger" size="sm" onClick={endEvent}>End Event</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: Round + Question navigation ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Phase controls */}
          <Card>
            <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-4">Controls</h2>

            {liveState?.phase === 'lobby' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-navy/60">Select a round to begin.</p>
                <div className="flex flex-wrap gap-2">
                  {rounds.map((r) => (
                    <Button key={r.id} variant="secondary" size="sm" onClick={() => startRound(r)} loading={busy}>
                      Round {r.round_number}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {liveState?.phase === 'round_intro' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-navy/60">Show is on Round {currentRound?.round_number}. Go to first question?</p>
                <Button
                  onClick={() => roundQuestions[0] && showQuestion(roundQuestions[0])}
                  loading={busy}
                  disabled={roundQuestions.length === 0}
                >
                  Show Q1
                </Button>
              </div>
            )}

            {liveState?.phase === 'question' && currentQuestion && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={startTimer} loading={busy}>Start Timer</Button>
                <Button variant="ghost" onClick={revealAnswer} loading={busy}>Skip to Answer</Button>
              </div>
            )}

            {liveState?.phase === 'timer_running' && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={revealAnswer} loading={busy}>Reveal Answer</Button>
              </div>
            )}

            {liveState?.phase === 'answer_reveal' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  {!isLastQuestion ? (
                    <Button
                      onClick={() => roundQuestions[currentQIdx + 1] && showQuestion(roundQuestions[currentQIdx + 1])}
                      loading={busy}
                    >
                      Next Question (Q{currentQIdx + 2})
                    </Button>
                  ) : (
                    <Button onClick={showRoundLeaderboard} loading={busy}>Round Leaderboard</Button>
                  )}
                </div>
              </div>
            )}

            {liveState?.phase === 'round_leaderboard' && (
              <div className="flex flex-wrap gap-3">
                {!isLastRound ? (
                  <Button
                    onClick={() => {
                      const next = rounds.find((r) => r.round_number === (currentRound?.round_number ?? 0) + 1)
                      if (next) startRound(next)
                    }}
                    loading={busy}
                  >
                    Next Round
                  </Button>
                ) : (
                  <Button onClick={showFinalReveal} loading={busy} variant="primary">
                    Final Results
                  </Button>
                )}
              </div>
            )}

            {(liveState?.phase === 'final_reveal' || liveState?.phase === 'complete') && (
              <div className="flex flex-wrap gap-3">
                <Button variant="danger" onClick={endEvent}>End & Close Event</Button>
              </div>
            )}
          </Card>

          {/* Current question + answer */}
          {currentQuestion && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">
                Current Question — Q{currentQuestion.question_number}
                {currentRound && ` (Round ${currentRound.round_number})`}
              </h2>
              <p className="text-navy font-medium mb-2">{currentQuestion.question_text}</p>
              <div className="bg-pine/10 border border-pine/20 rounded-lg px-4 py-3">
                <p className="text-xs text-pine/60 uppercase font-semibold tracking-wider mb-1">Answer</p>
                <p className="text-pine font-semibold">{currentQuestion.answer_text}</p>
              </div>
            </Card>
          )}

          {/* Questions list for current round */}
          {currentRound && roundQuestions.length > 0 && (
            <Card padded={false}>
              <div className="px-6 py-4 border-b border-timber/10">
                <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">
                  Round {currentRound.round_number} — Jump to Question
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {roundQuestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => showQuestion(q)}
                    className={[
                      'text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      q.id === liveState?.current_question_id
                        ? 'bg-rust text-white'
                        : 'bg-snow hover:bg-navy/5 text-navy',
                    ].join(' ')}
                  >
                    <span className="font-semibold">Q{q.question_number}</span>
                    <span className="text-current/60 ml-2 truncate">
                      {q.question_text.slice(0, 40)}{q.question_text.length > 40 ? '…' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right: Score entry + leaderboard ── */}
        <div className="flex flex-col gap-4">
          {/* Score entry */}
          {currentRound && teams.length > 0 && (
            <Card padded={false}>
              <div className="px-4 py-3 border-b border-timber/10">
                <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">
                  Scores — Round {currentRound.round_number}
                </h2>
              </div>
              <ScoreGrid
                eventId={eventId}
                roundId={currentRound.id}
                teams={teams}
                onSave={saveScore}
              />
            </Card>
          )}

          {/* Live leaderboard */}
          <Card padded={false}>
            <div className="px-4 py-3 border-b border-timber/10">
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">Live Standings</h2>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-navy/40 text-xs text-center py-6">No scores yet.</p>
            ) : (
              <ul className="divide-y divide-timber/10">
                {leaderboard.slice(0, 8).map((e) => (
                  <li key={e.team_id} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-navy">{e.rank}. {e.team_name}</span>
                    <span className="text-xs text-navy/60 font-semibold">{e.total_points}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Score Grid sub-component ──────────────────────────────────────────────────

interface ScoreGridProps {
  eventId: string
  roundId: string
  teams: Team[]
  onSave: (teamId: string, roundId: string, pts: number) => void
}

function ScoreGrid({ eventId, roundId, teams, onSave }: ScoreGridProps) {
  const [scores, setScores] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('trivia_scores')
        .select('team_id, points')
        .eq('event_id', eventId)
        .eq('round_id', roundId)
      const map: Record<string, number> = {}
      for (const s of data ?? []) map[s.team_id] = s.points
      setScores(map)
    }
    load()
  }, [eventId, roundId])

  return (
    <ul className="divide-y divide-timber/10">
      {teams.map((team) => (
        <li key={team.id} className="px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-sm text-navy truncate">{team.name}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={scores[team.id] ?? 0}
            onChange={(e) => {
              const pts = Number(e.target.value)
              setScores((s) => ({ ...s, [team.id]: pts }))
              onSave(team.id, roundId, pts)
            }}
            className="w-14 text-right border border-timber/30 rounded px-2 py-1 text-sm text-navy bg-snow-card focus:outline-none focus:ring-1 focus:ring-rust"
          />
        </li>
      ))}
    </ul>
  )
}
