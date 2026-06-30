'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLiveState, updateLiveState } from '@/lib/realtime'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import type {
  TriviaLiveState, TriviaEvent, TriviaRound, TriviaQuestion, Team, LeaderboardEntry,
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
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const computeLeaderboard = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trivia_scores')
      .select('team_id, points, teams(name)')
      .eq('event_id', eventId)
    if (!data) return
    const totals: Record<string, { name: string; pts: number }> = {}
    for (const s of data as any[]) {
      if (!totals[s.team_id]) totals[s.team_id] = { name: s.teams?.name ?? '?', pts: 0 }
      totals[s.team_id].pts += Number(s.points)
    }
    const entries = Object.entries(totals)
      .sort(([, a], [, b]) => b.pts - a.pts)
      .map(([id, val], i) => ({ team_id: id, team_name: val.name, total_points: val.pts, rank: i + 1 }))
    setLeaderboard(entries)
  }, [eventId])

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const [{ data: all }, { data: etRows }] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('trivia_event_teams').select('team_id, teams(id,name,created_at)').eq('event_id', eventId),
    ])
    setAllTeams(all ?? [])
    setTeams((etRows ?? []).map((r: any) => r.teams).filter(Boolean))
  }, [eventId])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: evt }, { data: rds }, { data: state }] = await Promise.all([
        supabase.from('trivia_events').select('*').eq('id', eventId).single(),
        supabase.from('trivia_rounds').select('*').eq('event_id', eventId).order('round_number'),
        supabase.from('trivia_live_state').select('*').eq('event_id', eventId).single(),
      ])
      setEvent(evt)
      setRounds(rds ?? [])
      setLiveState(state)

      if (rds && rds.length > 0) {
        const { data: qs } = await supabase
          .from('trivia_questions').select('*')
          .in('round_id', rds.map(r => r.id)).order('question_number')
        setAllQuestions(qs ?? [])
      }
      setLoading(false)
    }
    load()
    loadTeams()
    computeLeaderboard()
  }, [eventId, computeLeaderboard, loadTeams])

  useLiveState(eventId, (newState) => {
    setLiveState(newState)
    computeLeaderboard()
  })

  // Auto-advance timer for round_intro → question
  useEffect(() => {
    if (liveState?.phase !== 'round_intro') {
      clearTimeout(autoAdvanceRef.current!)
      clearInterval(autoTickRef.current!)
      setAutoAdvanceCountdown(null)
      return
    }
    setAutoAdvanceCountdown(6)
    autoTickRef.current = setInterval(() => {
      setAutoAdvanceCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(autoTickRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
    autoAdvanceRef.current = setTimeout(() => {
      const firstQ = currentRoundQuestions[0]
      if (firstQ) act(() => showQuestion(firstQ))
    }, 6000)
    return () => {
      clearTimeout(autoAdvanceRef.current!)
      clearInterval(autoTickRef.current!)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState?.phase, liveState?.current_round_id])

  const currentRound = rounds.find(r => r.id === liveState?.current_round_id)
  const currentRoundQuestions = currentRound
    ? allQuestions.filter(q => q.round_id === currentRound.id).sort((a, b) => a.question_number - b.question_number)
    : []
  const currentQuestion = allQuestions.find(q => q.id === liveState?.current_question_id)
  const currentQIdx = currentRoundQuestions.findIndex(q => q.id === liveState?.current_question_id)
  const isLastQuestion = currentQIdx === currentRoundQuestions.length - 1
  const isLastRound = currentRound?.round_number === rounds.length
  const isMarkingRound = (currentRound?.round_number ?? 0) % 2 === 0

  // Questions used in the current marking session (current + previous round, by round_number)
  const markingRounds = currentRound
    ? rounds.filter(r => r.round_number === currentRound.round_number || r.round_number === currentRound.round_number - 1).sort((a, b) => a.round_number - b.round_number)
    : []
  const markingQuestions = markingRounds.flatMap(r =>
    allQuestions.filter(q => q.round_id === r.id).sort((a, b) => a.question_number - b.question_number)
  )
  const currentMarkingQ = markingQuestions[liveState?.marking_question_index ?? 0] ?? null
  const isLastMarkingQ = (liveState?.marking_question_index ?? 0) >= markingQuestions.length - 1

  // Break rounds are the same as marking rounds
  const breakRounds = markingRounds

  async function act(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  // ── Phase transitions ──────────────────────────────────────────────────────

  async function startShow() {
    await act(() => updateLiveState(eventId, { phase: 'game_overview' }))
  }

  async function startRound(round: TriviaRound) {
    await act(() => updateLiveState(eventId, {
      current_round_id: round.id,
      current_question_id: null,
      phase: 'round_intro',
      timer_started_at: null,
      leaderboard_revealed: false,
    }))
  }

  async function showQuestion(question: TriviaQuestion) {
    await act(() => updateLiveState(eventId, {
      current_question_id: question.id,
      phase: 'question',
      timer_started_at: null,
      media_fullscreen: false,
    }))
  }

  async function startTimer() {
    await act(() => updateLiveState(eventId, {
      phase: 'timer_running',
      timer_started_at: new Date().toISOString(),
    }))
  }

  async function revealAnswer() {
    await act(() => updateLiveState(eventId, { phase: 'answer_reveal', timer_started_at: null, media_fullscreen: false }))
  }

  async function toggleMediaFullscreen() {
    await act(() => updateLiveState(eventId, { media_fullscreen: !liveState?.media_fullscreen }))
  }

  async function endRound() {
    await act(() => updateLiveState(eventId, { phase: 'round_end' }))
  }

  async function startMarking() {
    await act(() => updateLiveState(eventId, {
      phase: 'marking',
      marking_question_index: 0,
      marking_revealed: false,
    }))
  }

  async function markingRevealAnswer() {
    await act(() => updateLiveState(eventId, { marking_revealed: true }))
  }

  async function markingNextQuestion() {
    const next = (liveState?.marking_question_index ?? 0) + 1
    await act(() => updateLiveState(eventId, { marking_question_index: next, marking_revealed: false }))
  }

  async function endMarking() {
    await act(() => updateLiveState(eventId, { phase: 'break', leaderboard_revealed: false }))
  }

  async function showBreakLeaderboard() {
    await act(() => updateLiveState(eventId, { leaderboard_revealed: true }))
  }

  async function nextRound() {
    const next = rounds.find(r => r.round_number === (currentRound?.round_number ?? 0) + 1)
    if (next) await startRound(next)
  }

  async function showFinalReveal() {
    await act(() => updateLiveState(eventId, { phase: 'final_reveal' }))
  }

  async function endEvent() {
    if (!confirm('End the event?')) return
    const supabase = createClient()
    await supabase.from('trivia_events').update({ status: 'complete' }).eq('id', eventId)
    await updateLiveState(eventId, { phase: 'complete' })
    router.push('/host')
  }

  async function resetEvent() {
    if (!confirm('Reset to lobby? This clears ALL scores and teams but keeps your questions.')) return
    const supabase = createClient()
    await Promise.all([
      supabase.from('trivia_scores').delete().eq('event_id', eventId),
      supabase.from('trivia_event_teams').delete().eq('event_id', eventId),
      supabase.from('trivia_events').update({ status: 'ready' }).eq('id', eventId),
    ])
    await updateLiveState(eventId, {
      phase: 'lobby',
      current_round_id: null,
      current_question_id: null,
      timer_started_at: null,
      leaderboard_revealed: false,
      marking_question_index: 0,
      marking_revealed: false,
    })
    router.refresh()
  }

  async function saveScore(teamId: string, roundId: string, pts: number) {
    const supabase = createClient()
    await supabase.from('trivia_scores').upsert(
      { event_id: eventId, round_id: roundId, team_id: teamId, points: pts },
      { onConflict: 'event_id,round_id,team_id' }
    )
    computeLeaderboard()
  }

  // ── Team management ────────────────────────────────────────────────────────

  const registeredIds = new Set(teams.map(t => t.id))
  const teamSuggestions = allTeams.filter(t =>
    !registeredIds.has(t.id) && t.name.toLowerCase().includes(teamSearch.toLowerCase())
  )

  async function addTeam(team: Team) {
    const supabase = createClient()
    await supabase.from('trivia_event_teams').insert({ event_id: eventId, team_id: team.id })
    await loadTeams()
    setTeamSearch('')
  }

  async function createAndAddTeam() {
    const name = newTeamName.trim().toUpperCase()
    if (!name) return
    const supabase = createClient()
    const existing = allTeams.find(t => t.name.toUpperCase() === name)
    if (existing) { await addTeam(existing); setNewTeamName(''); return }
    const { data: team } = await supabase.from('teams').insert({ name }).select('*').single()
    if (team) { await addTeam(team); setNewTeamName('') }
  }

  async function removeTeam(teamId: string) {
    const supabase = createClient()
    await supabase.from('trivia_event_teams').delete().eq('event_id', eventId).eq('team_id', teamId)
    await loadTeams()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-navy/40 text-sm">Loading…</p></div>
  }

  const phase = liveState?.phase ?? 'lobby'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy">{event?.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="live">LIVE</Badge>
            <span className="text-navy/50 text-sm font-mono capitalize">{phase.replace('_', ' ')}</span>
            {currentRound && <span className="text-navy/40 text-xs">Round {currentRound.round_number} — {currentRound.name}</span>}
          </div>
        </div>
        <div className="flex gap-3">
          <a href={`/host/trivia/${eventId}/display`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">Display ↗</Button>
          </a>
          <Button variant="ghost" size="sm" onClick={resetEvent} title="Reset to lobby — clears scores & teams, keeps questions">↺ Reset</Button>
          <Button variant="danger" size="sm" onClick={endEvent}>End</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left: controls ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── LOBBY ── */}
          {phase === 'lobby' && (
            <>
              <Card>
                <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-4">Team Registration</h2>
                {teams.length === 0 ? (
                  <p className="text-sm text-navy/40 mb-4">No teams yet — add them below.</p>
                ) : (
                  <ul className="divide-y divide-timber/10 mb-4 rounded-lg border border-timber/10 overflow-hidden">
                    {teams.map(t => (
                      <li key={t.id} className="px-4 py-2.5 flex items-center justify-between bg-snow-card">
                        <span className="font-semibold text-navy uppercase text-sm">{t.name}</span>
                        <button onClick={() => removeTeam(t.id)} className="text-navy/30 hover:text-red-500 text-xs transition-colors">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add existing */}
                <div className="mb-3">
                  <Input placeholder="Search existing teams…" value={teamSearch} onChange={e => setTeamSearch(e.target.value)} />
                  {teamSearch && teamSuggestions.length > 0 && (
                    <ul className="mt-1 bg-snow-card border border-timber/20 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                      {teamSuggestions.slice(0, 6).map(t => (
                        <li key={t.id}>
                          <button onClick={() => addTeam(t)} className="w-full text-left px-3 py-2 text-sm text-navy hover:bg-snow transition-colors uppercase">{t.name}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Create new */}
                <div className="flex gap-2">
                  <Input
                    placeholder="New team name…"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createAndAddTeam()}
                    className="flex-1"
                  />
                  <Button onClick={createAndAddTeam} disabled={!newTeamName.trim()} variant="secondary" size="sm">Add</Button>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">{teams.length} team{teams.length !== 1 ? 's' : ''} registered</p>
                    <p className="text-sm text-navy/50">Ready to start the show?</p>
                  </div>
                  <Button onClick={startShow} disabled={teams.length < 2} size="lg" loading={busy}>
                    LET THE GAMES BEGIN! →
                  </Button>
                </div>
              </Card>
            </>
          )}

          {/* ── GAME OVERVIEW ── */}
          {phase === 'game_overview' && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-4">Ready to Start</h2>
              <p className="text-sm text-navy/60 mb-4">The overview screen is showing on the display. Click START when you're ready to begin Round 1.</p>
              <Button onClick={() => startRound(rounds[0])} loading={busy} size="lg">
                START — Round 1 →
              </Button>
            </Card>
          )}

          {/* ── ROUND INTRO ── */}
          {phase === 'round_intro' && currentRound && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">Round {currentRound.round_number} Intro</h2>
              <p className="text-navy font-semibold mb-1">{currentRound.name}</p>
              {currentRound.description && <p className="text-sm text-navy/50 italic mb-4">{currentRound.description}</p>}
              {autoAdvanceCountdown !== null ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-snow rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-rust transition-all duration-1000"
                      style={{ width: `${((6 - autoAdvanceCountdown) / 6) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-navy/50">Q1 in {autoAdvanceCountdown}s…</span>
                  <Button
                    size="sm"
                    onClick={() => {
                      clearTimeout(autoAdvanceRef.current!)
                      clearInterval(autoTickRef.current!)
                      setAutoAdvanceCountdown(null)
                      const firstQ = currentRoundQuestions[0]
                      if (firstQ) act(() => showQuestion(firstQ))
                    }}
                    loading={busy}
                  >
                    Show Q1 Now
                  </Button>
                </div>
              ) : (
                <Button onClick={() => { const q = currentRoundQuestions[0]; if (q) act(() => showQuestion(q)) }} loading={busy}>
                  Show Q1
                </Button>
              )}
            </Card>
          )}

          {/* ── QUESTION / TIMER / ANSWER ── */}
          {(phase === 'question' || phase === 'timer_running' || phase === 'answer_reveal') && currentQuestion && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">
                    R{currentRound?.round_number} — Q{currentQuestion.question_number}
                    {currentQuestion.multiple_choice_options && <span className="ml-2 text-rust">(MC)</span>}
                  </h2>
                  <span className="text-xs text-navy/40">{currentQIdx + 1} of {currentRoundQuestions.length}</span>
                </div>

                <p className="text-navy font-medium mb-2">{currentQuestion.question_text}</p>

                {currentQuestion.multiple_choice_options && (
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {currentQuestion.multiple_choice_options.map((opt, i) => (
                      <div key={i} className={`text-xs px-2 py-1.5 rounded flex items-center gap-1.5 ${currentQuestion.correct_option_index === i ? 'bg-pine/10 text-pine font-semibold' : 'bg-snow text-navy/60'}`}>
                        <span className="font-bold">{['A','B','C','D'][i]}.</span> {opt}
                        {currentQuestion.correct_option_index === i && <span className="ml-auto">✓</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-pine/10 border border-pine/20 rounded-lg px-4 py-3 mb-4">
                  <p className="text-xs text-pine/60 uppercase font-semibold tracking-wider mb-1">Answer</p>
                  <p className="text-pine font-semibold">{currentQuestion.answer_text}</p>
                </div>

                {/* Fullscreen image toggle — shown when question has an image */}
                {currentQuestion?.media_type === 'image' && currentQuestion?.media_url && (
                  <div className="mb-3">
                    <Button
                      variant={liveState?.media_fullscreen ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={toggleMediaFullscreen}
                      loading={busy}
                    >
                      {liveState?.media_fullscreen ? '⊡ Shrink Image' : '⊞ Fullscreen Image'}
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {phase === 'question' && <Button onClick={startTimer} loading={busy}>▶ Start Timer</Button>}
                  {phase === 'question' && <Button variant="ghost" onClick={revealAnswer} loading={busy}>Skip to Answer</Button>}
                  {phase === 'timer_running' && <Button onClick={revealAnswer} loading={busy}>Reveal Answer</Button>}
                  {phase === 'answer_reveal' && !isLastQuestion && (
                    <Button onClick={() => { const q = currentRoundQuestions[currentQIdx + 1]; if (q) act(() => showQuestion(q)) }} loading={busy}>
                      Next Question (Q{currentQIdx + 2}) →
                    </Button>
                  )}
                  {phase === 'answer_reveal' && isLastQuestion && (
                    <Button onClick={endRound} loading={busy} variant="primary">End Round {currentRound?.round_number} →</Button>
                  )}
                </div>
              </Card>

              {/* Jump to question */}
              <Card padded={false}>
                <div className="px-4 py-3 border-b border-timber/10">
                  <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">Jump to Question</h2>
                </div>
                <div className="p-3 grid grid-cols-4 gap-1.5">
                  {currentRoundQuestions.map(q => (
                    <button
                      key={q.id}
                      onClick={() => act(() => showQuestion(q))}
                      className={`text-xs px-2 py-1.5 rounded transition-colors text-left ${q.id === liveState?.current_question_id ? 'bg-rust text-white' : 'bg-snow hover:bg-navy/5 text-navy'}`}
                    >
                      Q{q.question_number}
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ── ROUND END ── */}
          {phase === 'round_end' && currentRound && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">End of Round {currentRound.round_number}</h2>
              {isMarkingRound ? (
                <>
                  <p className="text-sm text-navy/60 mb-4">Round {currentRound.round_number} complete. Time to mark rounds {currentRound.round_number - 1} &amp; {currentRound.round_number}.</p>
                  <Button onClick={startMarking} loading={busy} variant="primary">Start Marking →</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-navy/60 mb-4">Round {currentRound.round_number} complete.</p>
                  <Button onClick={nextRound} loading={busy} variant="primary">Round {(currentRound.round_number) + 1} →</Button>
                </>
              )}
            </Card>
          )}

          {/* ── MARKING ── */}
          {phase === 'marking' && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">
                Marking — Q{(liveState?.marking_question_index ?? 0) + 1} of {markingQuestions.length}
              </h2>

              {currentMarkingQ && (
                <div className="mb-4">
                  <p className="text-xs text-navy/40 mb-1">
                    Round {markingRounds.find(r => r.id === currentMarkingQ.round_id)?.round_number} · Q{currentMarkingQ.question_number}
                  </p>
                  <p className="text-navy font-medium mb-3">{currentMarkingQ.question_text}</p>

                  {currentMarkingQ.multiple_choice_options && (
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {currentMarkingQ.multiple_choice_options.map((opt, i) => (
                        <div key={i} className={`text-xs px-2 py-1.5 rounded flex items-center gap-1.5 ${currentMarkingQ.correct_option_index === i ? 'bg-pine/10 text-pine font-semibold' : 'bg-snow text-navy/60'}`}>
                          <span className="font-bold">{['A','B','C','D'][i]}.</span> {opt}
                          {currentMarkingQ.correct_option_index === i && <span className="ml-auto">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {liveState?.marking_revealed && (
                    <div className="bg-pine/10 border border-pine/20 rounded-lg px-4 py-3 mb-3">
                      <p className="text-xs text-pine/60 uppercase font-semibold tracking-wider mb-1">Answer</p>
                      <p className="text-pine font-semibold">{currentMarkingQ.answer_text}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {!liveState?.marking_revealed && (
                  <Button onClick={markingRevealAnswer} loading={busy} variant="primary">Reveal Answer</Button>
                )}
                {liveState?.marking_revealed && !isLastMarkingQ && (
                  <Button onClick={markingNextQuestion} loading={busy}>Next Question →</Button>
                )}
                {liveState?.marking_revealed && isLastMarkingQ && (
                  <Button onClick={endMarking} loading={busy} variant="primary">Done Marking → Break</Button>
                )}
              </div>
            </Card>
          )}

          {/* ── BREAK ── */}
          {phase === 'break' && (
            <>
              <Card>
                <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">Break — Enter Scores</h2>
                <p className="text-sm text-navy/50 mb-4">
                  Marking rounds {breakRounds.map(r => r.round_number).join(' & ')}. Enter each team's scores then show the leaderboard.
                </p>
                <div className="space-y-4">
                  {breakRounds.map(round => (
                    <div key={round.id}>
                      <h3 className="text-xs font-semibold text-navy/60 uppercase tracking-wider mb-2">Round {round.round_number} — {round.name}</h3>
                      <ScoreGrid eventId={eventId} roundId={round.id} teams={teams} onSave={saveScore} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    {!liveState?.leaderboard_revealed
                      ? <p className="text-sm text-navy/60">When scores are in, show the leaderboard on the display.</p>
                      : <p className="text-sm text-navy/60">Leaderboard is showing. Ready for the next round?</p>
                    }
                  </div>
                  <div className="flex gap-3">
                    {!liveState?.leaderboard_revealed && (
                      <Button onClick={showBreakLeaderboard} loading={busy}>Show Leaderboard</Button>
                    )}
                    {liveState?.leaderboard_revealed && !isLastRound && (
                      <Button onClick={nextRound} loading={busy} variant="primary">Next Round →</Button>
                    )}
                    {liveState?.leaderboard_revealed && isLastRound && (
                      <Button onClick={showFinalReveal} loading={busy} variant="primary">Final Results →</Button>
                    )}
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* ── FINAL REVEAL ── */}
          {(phase === 'final_reveal' || phase === 'complete') && (
            <Card>
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider mb-3">Final Results</h2>
              <Button variant="danger" onClick={endEvent}>End &amp; Close Event</Button>
            </Card>
          )}
        </div>

        {/* ── Right: live standings ── */}
        <div className="space-y-4">
          <Card padded={false}>
            <div className="px-4 py-3 border-b border-timber/10">
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">Live Standings</h2>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-navy/40 text-xs text-center py-6">No scores yet.</p>
            ) : (
              <ul className="divide-y divide-timber/10">
                {leaderboard.slice(0, 10).map(e => (
                  <li key={e.team_id} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-navy">{e.rank}. {e.team_name}</span>
                    <span className="text-xs text-navy/60 font-semibold">{e.total_points}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Phase guide */}
          <Card padded={false}>
            <div className="px-4 py-3 border-b border-timber/10">
              <h2 className="text-xs font-semibold text-timber uppercase tracking-wider">Rounds</h2>
            </div>
            <ul className="divide-y divide-timber/10">
              {rounds.map(r => (
                <li key={r.id} className={`px-4 py-2 flex items-center gap-2 text-xs ${r.id === liveState?.current_round_id ? 'bg-rust/5' : ''}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${r.id === liveState?.current_round_id ? 'bg-rust text-white' : 'bg-snow text-navy/50'}`}>
                    {r.round_number}
                  </span>
                  <span className={`flex-1 truncate ${r.id === liveState?.current_round_id ? 'text-navy font-medium' : 'text-navy/50'}`}>{r.name}</span>
                  {r.round_number % 2 === 0 && <span className="text-navy/30 text-xs">✎</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Score Grid ────────────────────────────────────────────────────────────────

function ScoreGrid({ eventId, roundId, teams, onSave }: {
  eventId: string; roundId: string; teams: Team[]
  onSave: (teamId: string, roundId: string, pts: number) => void
}) {
  const [scores, setScores] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('trivia_scores').select('team_id, points')
        .eq('event_id', eventId).eq('round_id', roundId)
      const map: Record<string, number> = {}
      for (const s of data ?? []) map[s.team_id] = s.points
      setScores(map)
    }
    load()
  }, [eventId, roundId])

  return (
    <ul className="divide-y divide-timber/10 border border-timber/10 rounded-lg overflow-hidden">
      {teams.map(team => (
        <li key={team.id} className="px-4 py-2 flex items-center justify-between gap-2 bg-snow-card">
          <span className="text-sm text-navy truncate uppercase">{team.name}</span>
          <input
            type="number" min={0} step={1}
            value={scores[team.id] ?? 0}
            onChange={e => {
              const pts = Number(e.target.value)
              setScores(s => ({ ...s, [team.id]: pts }))
              onSave(team.id, roundId, pts)
            }}
            className="w-16 text-right border border-timber/30 rounded px-2 py-1 text-sm text-navy bg-white focus:outline-none focus:ring-1 focus:ring-rust"
          />
        </li>
      ))}
    </ul>
  )
}
