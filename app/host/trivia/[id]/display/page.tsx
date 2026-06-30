'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { createClient } from '@/lib/supabase/client'
import { useLiveState } from '@/lib/realtime'
import { playSound, stopSound } from '@/lib/sounds'
import { SnowfallEffect } from '@/components/show/SnowfallEffect'
import { TimerBar } from '@/components/show/TimerBar'
import { MediaDisplay } from '@/components/show/MediaDisplay'
import { ShowLeaderboard } from '@/components/show/ShowLeaderboard'
import type {
  TriviaLiveState, TriviaEvent, TriviaRound, TriviaQuestionPublic, Team, LeaderboardEntry,
} from '@/lib/types'

// ─── Scramble text reveal ─────────────────────────────────────────────────────
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!@#$%&*'

function ScrambleText({ text }: { text: string }) {
  const upper = text.toUpperCase()
  const [chars, setChars] = useState<Array<{ ch: string; locked: boolean }>>(() =>
    upper.split('').map(l => ({
      ch: l === ' ' ? ' ' : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
      locked: l === ' ',
    }))
  )

  useEffect(() => {
    const letters = upper.split('')
    const perLetterMs = Math.min(110, Math.max(40, Math.floor(1600 / Math.max(letters.length, 1))))

    setChars(letters.map(l => ({
      ch: l === ' ' ? ' ' : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
      locked: l === ' ',
    })))

    const scrambleId = setInterval(() => {
      setChars(prev => prev.map(item =>
        item.locked ? item : { ch: SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)], locked: false }
      ))
    }, 55)

    const lockTimers = letters.map((letter, i) =>
      setTimeout(() => {
        setChars(prev => {
          const next = [...prev]
          next[i] = { ch: letter === ' ' ? ' ' : letter, locked: true }
          return next
        })
      }, 350 + i * perLetterMs)
    )

    const stopId = setTimeout(() => clearInterval(scrambleId), 350 + letters.length * perLetterMs + 150)

    return () => {
      clearInterval(scrambleId)
      lockTimers.forEach(clearTimeout)
      clearTimeout(stopId)
    }
  }, [upper])

  return (
    <>
      {chars.map((item, i) => (
        <span
          key={i}
          style={{
            color: item.locked ? '#ffffff' : 'rgba(255,255,255,0.22)',
            transition: item.locked ? 'color 0.08s' : 'none',
            display: item.ch === ' ' ? 'inline' : 'inline-block',
            minWidth: item.ch === ' ' ? '0.35em' : undefined,
            fontFamily: 'var(--font-jost)',
            fontWeight: 900,
          }}
        >
          {item.ch}
        </span>
      ))}
    </>
  )
}

// ─── Transition presets ────────────────────────────────────────────────────────
const slide = {
  initial: { opacity: 0, y: 50, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 0.97 },
}
const pop = {
  initial: { opacity: 0, scale: 0.7 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.1 },
}

// ─── Multiple choice option labels ────────────────────────────────────────────
const MC_LABELS = ['A', 'B', 'C', 'D']
const MC_COLORS = [
  'border-blue-400/40 bg-blue-500/10',
  'border-orange-400/40 bg-orange-500/10',
  'border-purple-400/40 bg-purple-500/10',
  'border-green-400/40 bg-green-500/10',
]
const MC_CORRECT = 'border-pine bg-pine/20 text-pine'

export default function DisplayPage() {
  const params = useParams()
  const eventId = params.id as string

  const [liveState, setLiveState] = useState<TriviaLiveState | null>(null)
  const [event, setEvent] = useState<TriviaEvent | null>(null)
  const [rounds, setRounds] = useState<TriviaRound[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [question, setQuestion] = useState<TriviaQuestionPublic | null>(null)
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalEntries, setFinalEntries] = useState<LeaderboardEntry[]>([])
  const [finalRevealIdx, setFinalRevealIdx] = useState(-1)
  const [markingQuestions, setMarkingQuestions] = useState<TriviaQuestionPublic[]>([])
  const [markingAnswer, setMarkingAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const prevPhaseRef = useRef<string | null>(null)
  const prevMarkingIdxRef = useRef<number>(-1)
  // Ref so the reactive fetch effect always sees the latest questions without stale closure
  const markingQuestionsRef = useRef<TriviaQuestionPublic[]>([])

  const computeLeaderboard = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trivia_scores').select('team_id, points, teams(name)').eq('event_id', eventId)
    if (!data) return []
    const totals: Record<string, { name: string; pts: number }> = {}
    for (const s of data as any[]) {
      if (!totals[s.team_id]) totals[s.team_id] = { name: s.teams?.name ?? '?', pts: 0 }
      totals[s.team_id].pts += Number(s.points)
    }
    return Object.entries(totals)
      .sort(([, a], [, b]) => b.pts - a.pts)
      .map(([id, val], i) => ({ team_id: id, team_name: val.name, total_points: val.pts, rank: i + 1 }))
  }, [eventId])

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trivia_event_teams').select('team_id, teams(id,name,created_at)').eq('event_id', eventId)
    setTeams((data ?? []).map((r: any) => r.teams).filter(Boolean))
  }, [eventId])

  const loadMarkingQuestions = useCallback(async (currentRoundId: string, allRounds: TriviaRound[]) => {
    const supabase = createClient()
    const currentRound = allRounds.find(r => r.id === currentRoundId)
    if (!currentRound) return []
    const markingRounds = allRounds.filter(
      r => r.round_number === currentRound.round_number || r.round_number === currentRound.round_number - 1
    ).sort((a, b) => a.round_number - b.round_number)
    if (markingRounds.length === 0) return []
    const { data } = await supabase
      .from('trivia_questions_public').select('*')
      .in('round_id', markingRounds.map(r => r.id)).order('question_number')
    // Sort by round order then question number
    const sorted = (data ?? []).sort((a: any, b: any) => {
      const aRound = markingRounds.findIndex(r => r.id === a.round_id)
      const bRound = markingRounds.findIndex(r => r.id === b.round_id)
      if (aRound !== bRound) return aRound - bRound
      return a.question_number - b.question_number
    })
    return sorted as TriviaQuestionPublic[]
  }, [])

  const fetchAnswer = useCallback(async (questionId: string) => {
    const res = await fetch(`/api/trivia/answer?questionId=${questionId}`)
    if (res.ok) {
      const { answer } = await res.json()
      return answer as string
    }
    return null
  }, [])

  const handleStateChange = useCallback(async (
    state: TriviaLiveState,
    currentRounds?: TriviaRound[]
  ) => {
    const supabase = createClient()
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = state.phase

    // Load current question (no answer)
    if (state.current_question_id &&
        state.phase !== 'answer_reveal' &&
        state.phase !== 'marking' &&
        state.phase !== 'round_end' &&
        state.phase !== 'break') {
      const { data: q } = await supabase
        .from('trivia_questions_public').select('*').eq('id', state.current_question_id).single()
      setQuestion(q)
      setRevealedAnswer(null)
    }

    // Answer reveal
    if (state.phase === 'answer_reveal' && state.current_question_id) {
      const ans = await fetchAnswer(state.current_question_id)
      setRevealedAnswer(ans)
      playSound('reveal')
    }

    // Marking — load questions when entering the phase (answer fetch handled by useEffect below)
    if (state.phase === 'marking' && state.current_round_id && markingQuestionsRef.current.length === 0) {
      const rds = currentRounds ?? rounds
      const qs = await loadMarkingQuestions(state.current_round_id, rds)
      setMarkingQuestions(qs)
      markingQuestionsRef.current = qs
    }

    // Break leaderboard
    if (state.phase === 'break' && state.leaderboard_revealed) {
      const entries = await computeLeaderboard()
      setLeaderboard(entries)
      playSound('drumroll')
    }

    // Round leaderboard
    if (state.phase === 'round_leaderboard') {
      const entries = await computeLeaderboard()
      setLeaderboard(entries)
      playSound('drumroll')
    }

    // Final reveal
    if (state.phase === 'final_reveal') {
      const entries = await computeLeaderboard()
      const reversed = [...entries].reverse()
      setFinalEntries(reversed)
      setFinalRevealIdx(-1)
      playSound('drumroll')
      let idx = 0
      const interval = setInterval(() => {
        setFinalRevealIdx(idx)
        idx++
        if (idx >= reversed.length) {
          clearInterval(interval)
          playSound('fanfare')
          setTimeout(() => {
            confetti({ particleCount: 250, spread: 130, origin: { y: 0.5 }, colors: ['#F7F4ED', '#E0A53C', '#C8552D', '#23402F'] })
          }, 300)
        }
      }, 1500)
    }

    // Timer sounds
    if (state.phase === 'timer_running') playSound('tick')
    if (prevPhase === 'timer_running' && state.phase !== 'timer_running') stopSound('tick')
  }, [computeLeaderboard, fetchAnswer, loadMarkingQuestions, markingQuestions, rounds])

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
      if (state) {
        setLiveState(state)
        await handleStateChange(state, rds ?? [])
      }
      setLoading(false)
    }
    load()
    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // Realtime: live state changes
  useLiveState(eventId, async (newState) => {
    setLiveState(newState)
    await handleStateChange(newState)
  })

  // Realtime: team list updates during lobby
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`teams-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trivia_event_teams', filter: `event_id=eq.${eventId}` }, () => {
        loadTeams()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eventId, loadTeams])

  // Keep markingQuestionsRef in sync so the fetch effect below never has a stale closure
  useEffect(() => {
    markingQuestionsRef.current = markingQuestions
  }, [markingQuestions])

  // Reactively fetch the marking answer whenever revealed state changes.
  // Runs independently of handleStateChange to avoid stale-closure race conditions.
  useEffect(() => {
    if (liveState?.phase !== 'marking' || !liveState.marking_revealed) {
      setMarkingAnswer(null)
      return
    }
    const idx = liveState.marking_question_index ?? 0
    const mq = markingQuestionsRef.current[idx]
    if (!mq) return
    let cancelled = false
    fetchAnswer(mq.id).then(ans => {
      if (!cancelled && ans) {
        setMarkingAnswer(ans)
        playSound('reveal')
      }
    })
    return () => { cancelled = true }
  }, [liveState?.phase, liveState?.marking_revealed, liveState?.marking_question_index, fetchAnswer])

  const currentRound = rounds.find(r => r.id === liveState?.current_round_id)
  const timerDuration = currentRound?.time_limit_seconds ?? event?.default_time_limit_seconds ?? 30
  const currentMarkingQ = markingQuestions[liveState?.marking_question_index ?? 0] ?? null
  const markingRound = rounds.find(r => r.id === currentMarkingQ?.round_id)
  const isMarkingLastRound = rounds.length > 0 && currentRound?.round_number === rounds.length

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-smiggins-blue flex items-center justify-center">
        <div className="text-white/40 font-display text-3xl tracking-wide">Loading…</div>
      </div>
    )
  }

  const phase = liveState?.phase ?? 'lobby'

  return (
    <div className="fixed inset-0 z-50 bg-smiggins-blue text-white overflow-hidden select-none">
      <AnimatePresence mode="wait">

        {/* ── LOBBY ──────────────────────────────────────────────────────────── */}
        {phase === 'lobby' && (
          <motion.div key="lobby" {...slide} transition={{ duration: 0.7 }}
            className="absolute inset-0 flex z-10"
          >
            <SnowfallEffect />

            {/* Left: Branding */}
            <div className="relative z-10 w-1/2 flex flex-col items-center justify-center gap-4 px-12 border-r border-white/10">
              <img src="/smigginslogo-white.png" alt="Smiggins Hotel" className="object-contain opacity-90" style={{ height: 'clamp(70px, 8vw, 110px)' }} />
              <div className="text-center leading-none">
                <h1 className="font-display text-white tracking-wide" style={{ fontSize: 'clamp(5rem, 10vw, 13rem)', lineHeight: 0.9 }}>TRIVIA</h1>
                <h2 className="font-display tracking-widest" style={{ fontSize: 'clamp(2.2rem, 4.2vw, 5.5rem)', color: '#C8552D', lineHeight: 1, marginTop: '0.1em' }}>TUESDAY</h2>
              </div>
              <p className="font-dancing text-white/60" style={{ fontSize: 'clamp(1.4rem, 2.2vw, 2.6rem)', marginTop: '0.5em' }}>Hosted by Freddy Holler</p>
              <p className="text-white/30 tracking-[0.3em] uppercase" style={{ fontSize: 'clamp(0.6rem, 0.9vw, 1rem)', marginTop: '0.3em' }}>TUESDAY · 9:00PM</p>
            </div>

            {/* Right: Team list */}
            <div className="relative z-10 w-1/2 flex flex-col justify-center px-12 gap-5">
              <h2 className="font-display tracking-wide text-white/50" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 3rem)' }}>TONIGHT&apos;S TEAMS</h2>
              {teams.length === 0 ? (
                <p className="text-white/30" style={{ fontSize: 'clamp(1rem, 1.6vw, 2rem)' }}>Waiting for teams to register…</p>
              ) : (
                <div className="flex flex-col">
                  <AnimatePresence>
                    {teams.map((team, i) => (
                      <motion.div
                        key={team.id}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                        className="flex items-center gap-4 border-b border-white/10 py-3"
                      >
                        <span className="text-white/25 font-display shrink-0 text-right" style={{ fontSize: 'clamp(1rem, 1.8vw, 2.2rem)', minWidth: '2em' }}>{i + 1}</span>
                        <span className="font-display uppercase tracking-wide text-white" style={{ fontSize: 'clamp(1.2rem, 2.2vw, 2.8rem)' }}>{team.name}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              {teams.length >= 2 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="text-white/25 tracking-widest uppercase" style={{ fontSize: 'clamp(0.6rem, 0.85vw, 1rem)', marginTop: '0.5em' }}
                >
                  {teams.length} teams ready · Waiting for host to start…
                </motion.p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── GAME OVERVIEW ──────────────────────────────────────────────────── */}
        {phase === 'game_overview' && (
          <motion.div key="game-overview" {...slide} transition={{ duration: 0.6 }}
            className="absolute inset-0 flex flex-col z-10"
            style={{ padding: '2vh 7vw' }}
          >
            <SnowfallEffect />
            <div className="relative z-10 flex flex-col h-full">

              {/* Heading */}
              <motion.div
                initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                className="text-center" style={{ marginBottom: '1.5vh' }}
              >
                <p className="text-white/35 uppercase tracking-[0.4em]" style={{ fontSize: 'clamp(0.5rem, 0.8vw, 1rem)', marginBottom: '0.5vh' }}>
                  Smiggins Hotel · 4 Pines Brewing
                </p>
                <h1 className="font-display text-white tracking-wide" style={{ fontSize: 'clamp(2rem, 4.5vw, 7rem)', lineHeight: 1 }}>
                  TONIGHT&apos;S LINEUP
                </h1>
              </motion.div>

              {/* Top rule */}
              <div className="bg-white/20" style={{ height: 2, marginBottom: '1.2vh' }} />

              {/* Rounds list — flex-1 so it fills remaining height */}
              <div className="flex-1 flex flex-col justify-center" style={{ gap: 0 }}>
                {rounds.map((round, i) => (
                  <motion.div
                    key={round.id}
                    initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07, duration: 0.35 }}
                    className="flex items-baseline border-b border-white/10 last:border-0"
                    style={{ paddingTop: '0.9vh', paddingBottom: '0.9vh', gap: '2vw' }}
                  >
                    <span
                      className="font-display shrink-0 text-right"
                      style={{
                        fontSize: 'clamp(1.4rem, 2.5vw, 4rem)',
                        color: round.round_number === rounds.length ? '#E0A53C' : '#C8552D',
                        minWidth: '2em', lineHeight: 1,
                      }}
                    >
                      {round.round_number}
                    </span>

                    <div className="flex-1">
                      <span
                        className="font-display text-white uppercase tracking-wide"
                        style={{ fontSize: 'clamp(1.2rem, 2.3vw, 3.8rem)', lineHeight: 1 }}
                      >
                        {round.name}
                      </span>
                      {round.description && (
                        <p
                          className="text-white/45 italic"
                          style={{ fontSize: 'clamp(0.6rem, 0.95vw, 1.5rem)', marginTop: '0.25em', fontFamily: 'var(--font-body)' }}
                        >
                          {round.description}
                        </p>
                      )}
                    </div>

                    {round.round_number === rounds.length && (
                      <span
                        className="font-display text-mustard shrink-0"
                        style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1.6rem)', letterSpacing: '0.08em' }}
                      >
                        ⚡ ×2 PTS
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Bottom rule */}
              <div className="bg-white/20" style={{ height: 2, marginTop: '1.2vh', marginBottom: '1vh' }} />

              {/* Rules */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                className="flex items-center justify-center text-white/50 uppercase tracking-widest"
                style={{ gap: '2.5vw', fontSize: 'clamp(0.5rem, 0.9vw, 1.2rem)', paddingBottom: '1vh' }}
              >
                <span>⏱ 30 seconds per question</span>
                <span className="text-white/20">·</span>
                <span>✎ Swap sheets every 2 rounds</span>
                <span className="text-white/20">·</span>
                <span style={{ color: '#E0A53C' }}>★ Double points — final round</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── ROUND INTRO ─────────────────────────────────────────────────────── */}
        {phase === 'round_intro' && currentRound && (
          <motion.div key={`round-intro-${currentRound.id}`} {...pop} transition={{ duration: 0.6 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-6"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center max-w-3xl px-8">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: 'backOut' }}
                className="w-28 h-28 bg-rust rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
              >
                <span className="font-display text-white text-6xl">{currentRound.round_number}</span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="text-white/40 uppercase tracking-widest text-sm mb-2"
              >
                Round {currentRound.round_number} of {rounds.length}
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="font-display text-7xl text-white tracking-wide leading-tight mb-4"
              >
                {currentRound.name}
              </motion.h2>

              {currentRound.description && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="text-white/50 text-xl italic"
                >
                  &ldquo;{currentRound.description}&rdquo;
                </motion.p>
              )}

              {currentRound.round_number === rounds.length && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 }}
                  className="mt-6 inline-block bg-mustard/20 border border-mustard rounded-full px-6 py-2"
                >
                  <span className="text-mustard font-semibold tracking-wide">⚡ DOUBLE POINTS THIS ROUND</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── QUESTION ────────────────────────────────────────────────────────── */}
        {(phase === 'question' || phase === 'timer_running') && question && (
          <motion.div key={`question-${question.id}`} {...slide} transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 gap-6"
          >
            {/* Top bar */}
            <div className="absolute top-8 left-0 right-0 px-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentRound && (
                  <span className="bg-rust text-white font-display text-lg px-4 py-1.5 rounded-full">
                    ROUND {currentRound.round_number}
                  </span>
                )}
                <span className="text-white/40 font-display text-xl">Q{question.question_number}</span>
              </div>
              {question.points > 1 && (
                <span className="bg-mustard/20 border border-mustard text-mustard text-sm font-semibold px-4 py-1.5 rounded-full">
                  {question.points} pts
                </span>
              )}
            </div>

            {/* Question text */}
            <div className="text-center w-full max-w-4xl">
              <motion.h2
                key={question.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="text-4xl md:text-5xl font-semibold text-white leading-tight"
              >
                {question.question_text}
              </motion.h2>
            </div>

            {/* Multiple choice options */}
            {question.multiple_choice_options && Array.isArray(question.multiple_choice_options) && (
              <div className="grid grid-cols-2 gap-3 w-full max-w-3xl">
                {(question.multiple_choice_options as string[]).map((opt, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
                    className={`flex items-center gap-4 border rounded-xl px-6 py-4 ${MC_COLORS[i]}`}
                  >
                    <span className="font-display text-3xl text-white/60 w-8">{MC_LABELS[i]}</span>
                    <span className="text-white text-lg font-medium">{opt}</span>
                  </motion.div>
                ))}
              </div>
            )}

            <MediaDisplay mediaType={question.media_type} mediaUrl={question.media_url} />

            {/* Timer */}
            {phase === 'timer_running' && (
              <div className="w-full max-w-xs">
                <TimerBar timerStartedAt={liveState!.timer_started_at} durationSeconds={timerDuration} />
              </div>
            )}

            {phase === 'question' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="text-white/20 text-sm tracking-widest uppercase"
              >
                Timer starts when host is ready
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ── ANSWER REVEAL ───────────────────────────────────────────────────── */}
        {phase === 'answer_reveal' && question && (
          <motion.div key="answer-reveal" {...slide} transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 gap-8"
          >
            <div className="text-center max-w-4xl w-full">
              <p className="text-white/30 text-xl mb-6">{question.question_text}</p>

              {/* Multiple choice: highlight correct + show all */}
              {question.multiple_choice_options && Array.isArray(question.multiple_choice_options) ? (
                <div className="grid grid-cols-2 gap-3 w-full max-w-3xl mx-auto mb-6">
                  {(question.multiple_choice_options as string[]).map((opt, i) => {
                    const isCorrect = question.correct_option_index === i
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0.5, scale: 0.98 }}
                        animate={{
                          opacity: isCorrect ? 1 : 0.35,
                          scale: isCorrect ? 1.03 : 0.97,
                        }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className={`flex items-center gap-4 border rounded-xl px-6 py-4 ${isCorrect ? MC_CORRECT : 'border-white/10 bg-white/5'}`}
                      >
                        <span className={`font-display text-3xl w-8 ${isCorrect ? 'text-pine' : 'text-white/30'}`}>{MC_LABELS[i]}</span>
                        <span className={`text-lg font-medium ${isCorrect ? 'text-pine font-bold' : 'text-white/50'}`}>{opt}</span>
                        {isCorrect && (
                          <motion.span
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
                            className="ml-auto text-pine text-2xl"
                          >
                            ✓
                          </motion.span>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <motion.p
                  initial={{ opacity: 0, y: 24, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: 'backOut' }}
                  className="font-display uppercase tracking-wide mb-4"
                  style={{ fontSize: 'clamp(3rem, 7vw, 10rem)', color: '#E0A53C', lineHeight: 1.1 }}
                >
                  {revealedAnswer ?? '…'}
                </motion.p>
              )}

              <MediaDisplay mediaType={question.media_type} mediaUrl={question.media_url} />
            </div>
          </motion.div>
        )}

        {/* ── ROUND END ───────────────────────────────────────────────────────── */}
        {phase === 'round_end' && currentRound && (
          <motion.div key={`round-end-${currentRound.id}`} {...pop} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center px-12">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'backOut' }}
                className="font-display text-white tracking-wide"
                style={{ fontSize: 'clamp(4rem, 12vw, 18rem)', lineHeight: 1 }}
              >
                ROUND {currentRound.round_number}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="font-display text-rust tracking-wide"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 10rem)', lineHeight: 1, marginTop: '0.2em' }}
              >
                COMPLETE
              </motion.div>
              {(currentRound.round_number % 2 === 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  style={{ marginTop: '3vh' }}
                >
                  <p className="font-display text-mustard tracking-wide" style={{ fontSize: 'clamp(1.8rem, 4vw, 6rem)' }}>
                    SWAP YOUR ANSWER SHEETS!
                  </p>
                  <p className="text-mustard/50" style={{ fontSize: 'clamp(1rem, 1.8vw, 2.5rem)', marginTop: '0.5em' }}>
                    Pass to the team on your left
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── MARKING ─────────────────────────────────────────────────────────── */}
        {phase === 'marking' && (
          <motion.div key={`marking-${liveState?.marking_question_index}`} {...slide} transition={{ duration: 0.35 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 gap-8"
          >
            {/* Progress */}
            <div className="absolute top-6 left-0 right-0 px-12 flex items-center justify-between">
              <span className="font-display text-white/40 uppercase tracking-[0.3em]" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 2rem)' }}>
                Marking
              </span>
              <span className="text-white/40 font-display" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 2rem)' }}>
                {(liveState?.marking_question_index ?? 0) + 1} / {markingQuestions.length}
              </span>
            </div>

            {currentMarkingQ && (
              <div className="text-center w-full px-12">
                {/* Round indicator */}
                <p className="text-white/35 uppercase tracking-widest" style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.6rem)', marginBottom: '1.5vh' }}>
                  Round {markingRound?.round_number} · Q{currentMarkingQ.question_number}
                  {currentMarkingQ.points > 1 && <span className="text-mustard ml-2">({currentMarkingQ.points} pts)</span>}
                </p>

                {/* Question */}
                <h2 className="font-semibold text-white leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.8vw, 6rem)', marginBottom: '3vh' }}>
                  {currentMarkingQ.question_text}
                </h2>

                {/* Multiple choice options */}
                {currentMarkingQ.multiple_choice_options && Array.isArray(currentMarkingQ.multiple_choice_options) && (
                  <div className="grid grid-cols-2 gap-3 w-full max-w-4xl mx-auto" style={{ marginBottom: '2.5vh' }}>
                    {(currentMarkingQ.multiple_choice_options as string[]).map((opt, i) => {
                      const isCorrect = liveState?.marking_revealed && currentMarkingQ.correct_option_index === i
                      return (
                        <div key={i} className={`flex items-center gap-4 border rounded-xl transition-all duration-500 ${
                          isCorrect ? MC_CORRECT : liveState?.marking_revealed ? 'border-white/5 bg-white/3 opacity-40' : MC_COLORS[i]
                        }`} style={{ padding: '1.5vh 2vw' }}>
                          <span className={`font-display shrink-0 ${isCorrect ? 'text-pine' : 'text-white/60'}`} style={{ fontSize: 'clamp(1.2rem, 2.5vw, 4rem)' }}>{MC_LABELS[i]}</span>
                          <span className={`font-medium ${isCorrect ? 'text-pine font-bold' : 'text-white'}`} style={{ fontSize: 'clamp(1rem, 2vw, 3rem)' }}>{opt}</span>
                          {isCorrect && <span className="ml-auto text-pine" style={{ fontSize: 'clamp(1rem, 2vw, 3rem)' }}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Answer reveal — no box, big orange ScrambleText */}
                <AnimatePresence>
                  {liveState?.marking_revealed && (
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                      style={{ marginTop: '2vh' }}
                    >
                      <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                        className="text-white/35 uppercase tracking-[0.3em]"
                        style={{ fontSize: 'clamp(0.6rem, 1vw, 1.4rem)', marginBottom: '0.8vh' }}
                      >
                        Correct Answer
                      </motion.p>
                      <div style={{ fontSize: 'clamp(2.5rem, 6vw, 9rem)', lineHeight: 1.1, color: '#E0A53C', minHeight: '1.2em' }}>
                        {markingAnswer
                          ? <ScrambleText text={markingAnswer} />
                          : <span style={{ color: 'rgba(224,165,60,0.3)' }}>···</span>
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ── BREAK ───────────────────────────────────────────────────────────── */}
        {phase === 'break' && !liveState?.leaderboard_revealed && (
          <motion.div key="break" {...slide} transition={{ duration: 0.6 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-8"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center px-12">
              <motion.h1
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'backOut' }}
                className="font-display text-white tracking-wide"
                style={{ fontSize: 'clamp(5rem, 15vw, 22rem)', lineHeight: 1 }}
              >
                BREAK
              </motion.h1>
              <motion.h2
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="font-display text-rust tracking-wide"
                style={{ fontSize: 'clamp(2.5rem, 6vw, 9rem)', lineHeight: 1, marginTop: '0.1em', marginBottom: '0.5em' }}
              >
                TIME
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                className="text-white/60 mx-auto"
                style={{ fontSize: 'clamp(1.2rem, 2.4vw, 3.5rem)', maxWidth: '70vw', lineHeight: 1.4 }}
              >
                Grab a beverage or use the bathroom while Freddy tallies your scores.
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
                className="text-white/30 uppercase tracking-widest"
                style={{ fontSize: 'clamp(0.8rem, 1.4vw, 2rem)', marginTop: '1.5vh' }}
              >
                Leaderboard coming up soon…
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* ── BREAK LEADERBOARD ───────────────────────────────────────────────── */}
        {phase === 'break' && liveState?.leaderboard_revealed && (
          <motion.div key="break-leaderboard" {...slide} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 py-16"
          >
            <ShowLeaderboard
              entries={leaderboard}
              heading={
                currentRound && !isMarkingLastRound
                  ? `After Round ${currentRound.round_number}`
                  : 'Standings'
              }
            />
          </motion.div>
        )}

        {/* ── ROUND LEADERBOARD ───────────────────────────────────────────────── */}
        {phase === 'round_leaderboard' && (
          <motion.div key="round-leaderboard" {...slide} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 py-16"
          >
            <ShowLeaderboard
              entries={leaderboard}
              heading={currentRound ? `After Round ${currentRound.round_number}` : 'Leaderboard'}
            />
          </motion.div>
        )}

        {/* ── FINAL REVEAL ────────────────────────────────────────────────────── */}
        {phase === 'final_reveal' && (
          <motion.div key="final-reveal" {...slide} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 py-16"
          >
            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'backOut' }}
              className="font-display text-6xl text-white text-center tracking-wide mb-10"
            >
              FINAL RESULTS
            </motion.h2>
            <div className="w-full max-w-3xl px-6 flex flex-col gap-4">
              <AnimatePresence>
                {finalEntries.slice(0, finalRevealIdx + 1).map((entry, i) => (
                  <motion.div
                    key={entry.team_id}
                    initial={{ opacity: 0, x: -80, scale: 0.88 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.55, ease: 'backOut' }}
                    className={`flex items-center justify-between px-6 py-5 rounded-xl border ${
                      i === finalEntries.length - 1
                        ? 'bg-mustard/20 border-mustard'
                        : i === finalEntries.length - 2
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <span className={`font-display text-4xl ${
                        i === finalEntries.length - 1 ? 'text-mustard' : 'text-white/40'
                      }`}>
                        {finalEntries.length - i}
                      </span>
                      <span className={`text-2xl font-semibold uppercase ${
                        i === finalEntries.length - 1 ? 'text-mustard' : 'text-white'
                      }`}>{entry.team_name}</span>
                    </div>
                    <span className={`text-xl font-bold ${
                      i === finalEntries.length - 1 ? 'text-mustard' : 'text-white/60'
                    }`}>{entry.total_points} pts</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── COMPLETE ────────────────────────────────────────────────────────── */}
        {phase === 'complete' && (
          <motion.div key="complete" {...slide} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-6"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center">
              <p className="text-mustard font-display text-3xl tracking-wide mb-4">THAT&apos;S A WRAP!</p>
              <h1 className="font-display text-9xl tracking-wide text-white">THANKS</h1>
              <p className="text-white/50 text-xl mt-4">See you next Tuesday.</p>
              <p className="font-dancing text-3xl text-white/30 mt-3">Hosted by Freddy Holler</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Watermark */}
      <div className="fixed bottom-4 right-4 z-50 text-white/10 text-xs font-display tracking-widest">
        SMIGGINS.EVENTS
      </div>
    </div>
  )
}
