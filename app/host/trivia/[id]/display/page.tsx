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
  TriviaLiveState,
  TriviaEvent,
  TriviaRound,
  TriviaQuestionPublic,
  TriviaQuestion,
  LeaderboardEntry,
} from '@/lib/types'

// Slide transition variants
const slide = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 0.97 },
}

export default function DisplayPage() {
  const params = useParams()
  const eventId = params.id as string

  const [liveState, setLiveState] = useState<TriviaLiveState | null>(null)
  const [event, setEvent] = useState<TriviaEvent | null>(null)
  const [rounds, setRounds] = useState<TriviaRound[]>([])
  const [question, setQuestion] = useState<TriviaQuestionPublic | null>(null)
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalEntries, setFinalEntries] = useState<LeaderboardEntry[]>([])
  const [finalRevealIdx, setFinalRevealIdx] = useState(-1)
  const [loading, setLoading] = useState(true)

  const prevPhaseRef = useRef<string | null>(null)

  // Compute leaderboard from scores
  const computeLeaderboard = useCallback(async (forEventId: string, forRoundId?: string) => {
    const supabase = createClient()
    let query = supabase
      .from('trivia_scores')
      .select('team_id, points, teams(name)')
      .eq('event_id', forEventId)

    if (forRoundId) {
      query = query.eq('round_id', forRoundId)
    }

    const { data } = await query
    if (!data) return []

    const totals: Record<string, { name: string; pts: number }> = {}
    for (const s of data as any[]) {
      if (!totals[s.team_id]) totals[s.team_id] = { name: s.teams?.name ?? '?', pts: 0 }
      totals[s.team_id].pts += Number(s.points)
    }

    return Object.entries(totals)
      .sort(([, a], [, b]) => b.pts - a.pts)
      .map(([id, val], i) => ({
        team_id: id,
        team_name: val.name,
        total_points: val.pts,
        rank: i + 1,
      }))
  }, [])

  // Load initial data
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const handleStateChange = useCallback(async (
    state: TriviaLiveState,
    currentRounds?: TriviaRound[]
  ) => {
    const supabase = createClient()
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = state.phase

    // Load current question (without answer)
    if (state.current_question_id && state.phase !== 'answer_reveal') {
      const { data: q } = await supabase
        .from('trivia_questions_public')
        .select('*')
        .eq('id', state.current_question_id)
        .single()
      setQuestion(q)
      setRevealedAnswer(null)
    }

    // Fetch revealed answer via server route (keeps answer out of client on public anon key)
    if (state.phase === 'answer_reveal' && state.current_question_id) {
      const res = await fetch(`/api/trivia/answer?questionId=${state.current_question_id}`)
      if (res.ok) {
        const { answer } = await res.json()
        setRevealedAnswer(answer)
      }
      playSound('reveal')
    }

    // Round leaderboard
    if (state.phase === 'round_leaderboard' && state.current_round_id) {
      const entries = await computeLeaderboard(eventId, undefined)
      setLeaderboard(entries)
      playSound('drumroll')
      if (entries[0]?.team_id !== leaderboard[0]?.team_id) {
        setTimeout(() => {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }, 1200)
      }
    }

    // Final reveal — build list last→first, reveal one per second
    if (state.phase === 'final_reveal') {
      const entries = await computeLeaderboard(eventId, undefined)
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
            confetti({
              particleCount: 200,
              spread: 120,
              origin: { y: 0.5 },
              colors: ['#F7F4ED', '#E0A53C', '#C8552D', '#23402F'],
            })
          }, 300)
        }
      }, 1500)
    }

    // Timer sounds
    if (state.phase === 'timer_running') {
      playSound('tick')
    }
    if (prevPhase === 'timer_running' && state.phase !== 'timer_running') {
      stopSound('tick')
    }
  }, [computeLeaderboard, eventId, leaderboard])

  // Realtime subscription
  useLiveState(eventId, async (newState) => {
    setLiveState(newState)
    await handleStateChange(newState)
  })

  const currentRound = rounds.find((r) => r.id === liveState?.current_round_id)
  const timerDuration =
    currentRound?.time_limit_seconds ?? event?.default_time_limit_seconds ?? 30

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-white/40 font-display text-3xl tracking-wide">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white overflow-hidden relative select-none">
      <AnimatePresence mode="wait">
        {/* ── Lobby ─────────────────────────────────────────────── */}
        {(!liveState || liveState.phase === 'lobby') && (
          <motion.div
            key="lobby"
            {...slide}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-6"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center">
              <p className="text-timber tracking-widest uppercase text-sm mb-4">Smiggins Hotel</p>
              <h1 className="font-display text-9xl tracking-wide leading-none text-white">
                TRIVIA
              </h1>
              <h2 className="font-display text-5xl tracking-wide text-rust mt-2">
                NIGHT
              </h2>
              <p className="text-white/40 mt-6 text-lg">Round 1 starts soon…</p>
            </div>
          </motion.div>
        )}

        {/* ── Round Intro ────────────────────────────────────────── */}
        {liveState?.phase === 'round_intro' && currentRound && (
          <motion.div
            key={`round-intro-${currentRound.id}`}
            {...slide}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'backOut' }}
              className="bg-rust rounded-full w-32 h-32 flex items-center justify-center mb-6"
            >
              <span className="font-display text-white text-6xl">
                {currentRound.round_number}
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="font-display text-6xl text-white tracking-wide text-center"
            >
              {currentRound.name.toUpperCase()}
            </motion.h2>
            {currentRound.time_limit_seconds && (
              <p className="text-white/40 mt-4 text-lg">
                {currentRound.time_limit_seconds}s per question
              </p>
            )}
          </motion.div>
        )}

        {/* ── Question ────────────────────────────────────────────── */}
        {(liveState?.phase === 'question' || liveState?.phase === 'timer_running') && question && (
          <motion.div
            key={`question-${question.id}`}
            {...slide}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 gap-8"
          >
            <div className="text-center w-full max-w-4xl">
              {/* Round + Q indicator */}
              <div className="flex items-center justify-center gap-3 mb-6">
                {currentRound && (
                  <span className="bg-rust/20 text-rust font-display text-xl px-4 py-1 rounded-full">
                    ROUND {currentRound.round_number}
                  </span>
                )}
                <span className="text-white/40 font-display text-xl">
                  Q{question.question_number}
                </span>
                {question.points > 1 && (
                  <span className="bg-mustard/20 text-mustard text-sm font-semibold px-3 py-1 rounded-full">
                    {question.points} pts
                  </span>
                )}
              </div>

              <h2 className="text-4xl md:text-5xl font-semibold text-white leading-tight mb-8">
                {question.question_text}
              </h2>

              <MediaDisplay mediaType={question.media_type} mediaUrl={question.media_url} />
            </div>

            {liveState.phase === 'timer_running' && (
              <div className="w-full max-w-2xl">
                <TimerBar
                  timerStartedAt={liveState.timer_started_at}
                  durationSeconds={timerDuration}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* ── Answer Reveal ─────────────────────────────────────── */}
        {liveState?.phase === 'answer_reveal' && question && (
          <motion.div
            key="answer-reveal"
            {...slide}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 gap-10"
          >
            <div className="text-center max-w-4xl w-full">
              <p className="text-white/40 text-lg mb-4">{question.question_text}</p>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'backOut' }}
                className="bg-pine/50 border border-pine rounded-2xl px-12 py-8 inline-block"
              >
                <p className="text-xs font-semibold text-pine/60 uppercase tracking-widest mb-2">Answer</p>
                <p className="text-4xl md:text-6xl font-bold text-white">
                  {revealedAnswer ?? '…'}
                </p>
              </motion.div>

              <MediaDisplay mediaType={question.media_type} mediaUrl={question.media_url} />
            </div>
          </motion.div>
        )}

        {/* ── Round Leaderboard ─────────────────────────────────── */}
        {liveState?.phase === 'round_leaderboard' && (
          <motion.div
            key="round-leaderboard"
            {...slide}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 py-16"
          >
            <ShowLeaderboard
              entries={leaderboard}
              heading={currentRound ? `After Round ${currentRound.round_number}` : 'Leaderboard'}
            />
          </motion.div>
        )}

        {/* ── Final Reveal ─────────────────────────────────────── */}
        {liveState?.phase === 'final_reveal' && (
          <motion.div
            key="final-reveal"
            {...slide}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 py-16"
          >
            <h2 className="font-display text-5xl text-white text-center tracking-wide mb-10">
              FINAL RESULTS
            </h2>
            <div className="w-full max-w-3xl px-6 flex flex-col gap-4">
              <AnimatePresence>
                {finalEntries.slice(0, finalRevealIdx + 1).map((entry, i) => (
                  <motion.div
                    key={entry.team_id}
                    initial={{ opacity: 0, x: -60, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'backOut' }}
                    className={`flex items-center justify-between px-6 py-4 rounded-xl border ${
                      i === finalEntries.length - 1
                        ? 'bg-mustard/20 border-mustard text-mustard'
                        : 'bg-white/5 border-white/10 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-display text-3xl">
                        {finalEntries.length - i}
                      </span>
                      <span className="text-xl font-semibold">{entry.team_name}</span>
                    </div>
                    <span className="text-lg font-bold">{entry.total_points} pts</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Complete ─────────────────────────────────────────── */}
        {liveState?.phase === 'complete' && (
          <motion.div
            key="complete"
            {...slide}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-6"
          >
            <SnowfallEffect />
            <div className="relative z-10 text-center">
              <p className="text-mustard font-display text-3xl tracking-wide mb-4">THAT&apos;S A WRAP!</p>
              <h1 className="font-display text-8xl tracking-wide text-white">THANKS</h1>
              <p className="text-white/50 text-lg mt-4">See you next Tuesday.</p>
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
