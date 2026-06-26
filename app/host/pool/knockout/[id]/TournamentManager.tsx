'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { GeneratedMatch } from '@/app/actions/pool'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// All DB operations use the browser client directly (avoids server action
// serialisation issues that caused the infinite-spinner bug on create).
// ─────────────────────────────────────────────────────────────────────────────

async function dbGetOrCreatePlayer(name: string): Promise<{ id: string; name: string }> {
  const supabase = createClient()
  const trimmed = name.trim()
  const { data: existing } = await supabase
    .from('pool_players').select('id, name').ilike('name', trimmed).single()
  if (existing) return existing
  const { data, error } = await supabase
    .from('pool_players').insert({ name: trimmed }).select('id, name').single()
  if (error) throw new Error(error.message)
  return data
}

async function dbAddEntry(tournamentId: string, player: { id: string; name: string }) {
  const supabase = createClient()
  await supabase.from('pool_tournament_entries')
    .insert({ tournament_id: tournamentId, player_id: player.id })
}

async function dbRemoveEntry(tournamentId: string, playerId: string) {
  const supabase = createClient()
  await supabase.from('pool_tournament_entries')
    .delete().eq('tournament_id', tournamentId).eq('player_id', playerId)
}

async function dbGenerateDraw(tournamentId: string, playerEntries: Array<{ id: string; name: string }>): Promise<GeneratedMatch[]> {
  const supabase = createClient()
  // Fisher-Yates shuffle
  const players = [...playerEntries]
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]]
  }

  const matchRows: any[] = []
  let matchNum = 0
  for (let i = 0; i < players.length; i += 2) {
    matchNum++
    const tableNum = ((matchNum - 1) % 2) + 1
    const isBye = i + 1 >= players.length
    matchRows.push({
      tournament_id: tournamentId,
      round_number: 1,
      match_number: matchNum,
      table_number: tableNum,
      player1_id: players[i].id,
      player2_id: isBye ? null : players[i + 1].id,
      is_bye: isBye,
      status: isBye ? 'complete' : 'pending',
      winner_id: isBye ? players[i].id : null,
    })
  }

  const { error } = await supabase.from('pool_matches').insert(matchRows)
  if (error) throw new Error(error.message)

  // Update draw_order + tournament status
  for (let i = 0; i < players.length; i++) {
    await supabase.from('pool_tournament_entries')
      .update({ draw_order: i + 1 })
      .eq('tournament_id', tournamentId).eq('player_id', players[i].id)
  }
  await supabase.from('pool_tournaments').update({ status: 'active' }).eq('id', tournamentId)

  return matchRows.map((m, idx) => ({
    round_number: m.round_number,
    match_number: m.match_number,
    table_number: m.table_number,
    player1_id: m.player1_id,
    player1_name: players.find(p => p.id === m.player1_id)?.name ?? '',
    player2_id: m.player2_id,
    player2_name: m.player2_id ? (players.find(p => p.id === m.player2_id)?.name ?? '') : null,
    is_bye: m.is_bye,
  }))
}

async function dbRecordWinner(matchId: string, winnerId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('pool_matches')
    .update({ winner_id: winnerId, status: 'complete' }).eq('id', matchId)
  if (error) throw new Error(error.message)
}

async function dbGenerateNextRound(
  tournamentId: string,
  currentRound: number,
  currentMatches: Match[],
  maxMatchNum: number,
): Promise<GeneratedMatch[]> {
  const supabase = createClient()
  const winners = currentMatches
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map(m => m.winner!)

  if (winners.length <= 1) {
    await supabase.from('pool_tournaments').update({ status: 'complete' }).eq('id', tournamentId)
    return []
  }

  const nextRound = currentRound + 1
  const rows: any[] = []
  let matchNum = maxMatchNum

  for (let i = 0; i < winners.length; i += 2) {
    matchNum++
    const tableNum = ((rows.length) % 2) + 1
    const isBye = i + 1 >= winners.length
    rows.push({
      tournament_id: tournamentId,
      round_number: nextRound,
      match_number: matchNum,
      table_number: tableNum,
      player1_id: winners[i].id,
      player2_id: isBye ? null : winners[i + 1].id,
      is_bye: isBye,
      status: isBye ? 'complete' : 'pending',
      winner_id: isBye ? winners[i].id : null,
    })
  }

  const { error } = await supabase.from('pool_matches').insert(rows)
  if (error) throw new Error(error.message)

  return rows.map(m => ({
    round_number: m.round_number,
    match_number: m.match_number,
    table_number: m.table_number,
    player1_id: m.player1_id,
    player1_name: winners.find(w => w.id === m.player1_id)?.name ?? '',
    player2_id: m.player2_id,
    player2_name: m.player2_id ? (winners.find(w => w.id === m.player2_id)?.name ?? '') : null,
    is_bye: m.is_bye,
  }))
}

async function dbCompleteTournament(tournamentId: string) {
  const supabase = createClient()
  await supabase.from('pool_tournaments').update({ status: 'complete' }).eq('id', tournamentId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Player  { id: string; name: string }
interface Entry   { playerId: string; name: string }
interface Match {
  id: string; roundNumber: number; matchNumber: number; tableNumber: number
  isBye: boolean; status: string
  player1: Player | null; player2: Player | null; winner: Player | null
}
interface Tournament { id: string; name: string; eventDate: string; status: string }

interface Props {
  tournament: Tournament
  entries: Entry[]
  allPlayers: Player[]
  matches: Match[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw reveal animation component
// ─────────────────────────────────────────────────────────────────────────────
function DrawReveal({ matches, onDone }: { matches: GeneratedMatch[]; onDone: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'matches' | 'done'>('intro')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Intro → start revealing after 1.8s
    timerRef.current = setTimeout(() => setPhase('matches'), 1800)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    if (phase !== 'matches') return
    // Reveal one match every 2.4s
    if (revealedCount < matches.length) {
      timerRef.current = setTimeout(() => setRevealedCount(c => c + 1), 2400)
    } else {
      // All revealed — show done screen after 2s
      timerRef.current = setTimeout(() => setPhase('done'), 2000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, revealedCount, matches.length])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2448 50%, #081630 100%)' }}>

      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1, height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }} transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
              style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3rem,10vw,6rem)', fontWeight: 900, color: 'white', lineHeight: 1 }}>
              THE DRAW
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              style={{ fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginTop: 8, letterSpacing: '0.3em' }}>
              IS ABOUT TO BEGIN
            </motion.div>
          </motion.div>
        )}

        {phase === 'matches' && (
          <motion.div key="matches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl px-6">
            <div style={{ fontFamily: 'var(--font-jost)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em', textAlign: 'center', marginBottom: 32 }}>
              ROUND 1 DRAW — {matches.length} MATCH{matches.length !== 1 ? 'ES' : ''}
            </div>

            <div className="flex flex-col gap-4">
              {matches.map((match, idx) => (
                <AnimatePresence key={idx}>
                  {idx < revealedCount && (
                    <motion.div
                      initial={{ opacity: 0, y: 40, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
                      style={{
                        background: `linear-gradient(135deg, rgba(21,103,165,0.6) 0%, rgba(10,50,110,0.8) 100%)`,
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 16, padding: '16px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-jost)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.25em' }}>
                          MATCH {match.match_number}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-jost)', fontSize: '0.65rem', fontWeight: 700,
                          color: match.table_number === 1 ? '#E8820A' : '#E8CC00',
                          letterSpacing: '0.2em',
                          background: match.table_number === 1 ? 'rgba(232,130,10,0.15)' : 'rgba(232,204,0,0.15)',
                          borderRadius: 6, padding: '3px 8px',
                        }}>
                          TABLE {match.table_number}
                        </span>
                      </div>

                      {match.is_bye ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <motion.span initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            style={{ fontFamily: 'var(--font-jost)', fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>
                            {match.player1_name}
                          </motion.span>
                          <span style={{ fontFamily: 'var(--font-jost)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>BYE</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <motion.span initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 }}
                            style={{ flex: 1, fontFamily: 'var(--font-jost)', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                            {match.player1_name}
                          </motion.span>
                          <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.35 }}
                            style={{ fontFamily: 'var(--font-jost)', fontSize: '0.8rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                            VS
                          </motion.span>
                          <motion.span initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.55 }}
                            style={{ flex: 1, fontFamily: 'var(--font-jost)', fontSize: '1.25rem', fontWeight: 800, color: 'white', textAlign: 'right' }}>
                            {match.player2_name}
                          </motion.span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>

            {revealedCount < matches.length && (
              <motion.div className="text-center mt-8"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                <span style={{ fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
                  DRAWING...
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="text-center flex flex-col items-center gap-6">
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }} transition={{ delay: 0.3, duration: 0.6 }}
              style={{ fontSize: '4rem' }}>🎱</motion.div>
            <div style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(2rem,7vw,4rem)', fontWeight: 900, color: 'white' }}>
              DRAW COMPLETE!
            </div>
            <div style={{ fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
              {matches.filter(m => !m.is_bye).length} match{matches.filter(m => !m.is_bye).length !== 1 ? 'es' : ''} ready to play
            </div>
            <button onClick={onDone} style={{
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12,
              color: 'white', fontFamily: 'var(--font-jost)', fontWeight: 700,
              fontSize: '1rem', padding: '12px 32px', cursor: 'pointer',
              marginTop: 8,
            }}>
              View Bracket →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Match Card (bracket view)
// ─────────────────────────────────────────────────────────────────────────────
function MatchCard({ match, tournamentId, onWinnerRecorded }: {
  match: Match; tournamentId: string; onWinnerRecorded: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [localWinner, setLocalWinner] = useState<string | null>(match.winner?.id ?? null)

  async function selectWinner(playerId: string) {
    if (saving) return
    setSaving(true)
    setLocalWinner(playerId)
    try {
      await dbRecordWinner(match.id, playerId)
      onWinnerRecorded()
    } catch (e: any) {
      alert('Error saving winner: ' + e.message)
      setLocalWinner(null)
    } finally {
      setSaving(false)
    }
  }

  const isComplete = match.status === 'complete' || !!localWinner
  const tableColor = match.tableNumber === 1 ? '#E8820A' : '#E8CC00'

  if (match.isBye) {
    return (
      <div className="rounded-xl p-3 flex items-center gap-2"
        style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex-1 font-medium text-navy text-sm">{match.player1?.name}</div>
        <span className="text-xs text-navy/40 bg-navy/10 rounded px-2 py-0.5">BYE → advances</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid rgba(0,0,0,0.1)`, background: 'white' }}>
      <div className="px-3 py-1.5 flex justify-between items-center"
        style={{ background: `linear-gradient(90deg, ${tableColor}22 0%, transparent 100%)`, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tableColor }}>Table {match.tableNumber}</span>
        <span className="text-xs text-navy/40">Match {match.matchNumber}</span>
      </div>

      {/* Player 1 */}
      <button
        onClick={() => !isComplete && selectWinner(match.player1!.id)}
        disabled={isComplete || saving || !match.player1}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
        style={{
          background: localWinner === match.player1?.id ? 'rgba(34,160,80,0.1)' : 'transparent',
          cursor: isComplete ? 'default' : 'pointer',
        }}
      >
        <span className="text-sm font-medium text-navy">{match.player1?.name}</span>
        {localWinner === match.player1?.id && <span className="text-xs font-bold text-green-600">✓ WON</span>}
      </button>

      <div className="h-px bg-navy/6" />

      {/* Player 2 */}
      <button
        onClick={() => !isComplete && selectWinner(match.player2!.id)}
        disabled={isComplete || saving || !match.player2}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
        style={{
          background: localWinner === match.player2?.id ? 'rgba(34,160,80,0.1)' : 'transparent',
          cursor: isComplete ? 'default' : 'pointer',
        }}
      >
        <span className="text-sm font-medium text-navy">{match.player2?.name ?? '—'}</span>
        {localWinner === match.player2?.id && <span className="text-xs font-bold text-green-600">✓ WON</span>}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function TournamentManager({ tournament, entries, allPlayers, matches }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [localEntries, setLocalEntries] = useState(entries)
  const [localMatches, setLocalMatches] = useState(matches)
  const [drawMatches, setDrawMatches] = useState<GeneratedMatch[] | null>(null)
  const [showDraw, setShowDraw] = useState(false)
  const [drawLoading, setDrawLoading] = useState(false)
  const [nextRoundLoading, setNextRoundLoading] = useState(false)
  const [completingTournament, setCompletingTournament] = useState(false)
  const [status, setStatus] = useState(tournament.status)

  const enteredIds = new Set(localEntries.map(e => e.playerId))
  const suggestions = allPlayers.filter(
    p => !enteredIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function addPlayer(playerName: string) {
    const trimmed = playerName.trim()
    if (!trimmed) return
    setSearch('')
    try {
      const player = await dbGetOrCreatePlayer(trimmed)
      if (!enteredIds.has(player.id)) {
        await dbAddEntry(tournament.id, player)
        setLocalEntries(prev => [...prev, { playerId: player.id, name: player.name }])
      }
    } catch (e: any) {
      alert('Could not add player: ' + e.message)
    }
  }

  async function removePlayer(playerId: string) {
    setLocalEntries(prev => prev.filter(e => e.playerId !== playerId))
    try {
      await dbRemoveEntry(tournament.id, playerId)
    } catch { /* silently ignore */ }
  }

  async function handleGenerateDraw() {
    setDrawLoading(true)
    try {
      const playerList = localEntries
        .filter(e => !e.playerId.startsWith('pending-'))
        .map(e => ({ id: e.playerId, name: e.name }))
      const generated = await dbGenerateDraw(tournament.id, playerList)
      setDrawMatches(generated)
      setShowDraw(true)
      setStatus('active')
    } catch (e: any) {
      alert('Draw failed: ' + e.message)
    } finally {
      setDrawLoading(false)
    }
  }

  async function handleNextRound() {
    setNextRoundLoading(true)
    try {
      const maxMatchNum = localMatches.length > 0 ? Math.max(...localMatches.map(m => m.matchNumber)) : 0
      const generated = await dbGenerateNextRound(tournament.id, currentRound, currentRoundMatches, maxMatchNum)
      if (generated.length === 0) {
        setStatus('complete')
        router.refresh()
      } else {
        setDrawMatches(generated)
        setShowDraw(true)
        router.refresh()
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setNextRoundLoading(false)
    }
  }

  async function handleCompleteTournament() {
    setCompletingTournament(true)
    try {
      await dbCompleteTournament(tournament.id)
      setStatus('complete')
      router.refresh()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setCompletingTournament(false)
    }
  }

  // Compute bracket state from local matches (used by handleNextRound above too)
  const rounds = [...new Set(localMatches.map(m => m.roundNumber))].sort((a, b) => a - b)
  const currentRound = rounds.length > 0 ? Math.max(...rounds) : 0
  const currentRoundMatches = localMatches.filter(m => m.roundNumber === currentRound)
  const allCurrentRoundDone = currentRoundMatches.length > 0 &&
    currentRoundMatches.every(m => m.status === 'complete' || m.isBye)
  const currentRoundWinners = currentRoundMatches.filter(m => m.winner).map(m => m.winner!)
  const isFinalOver = allCurrentRoundDone && currentRoundWinners.length === 1

  const tournamentWinner = isFinalOver ? currentRoundWinners[0] : null

  const date = new Date(tournament.eventDate).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Draw reveal overlay */}
      {showDraw && drawMatches && (
        <DrawReveal
          matches={drawMatches}
          onDone={() => {
            setShowDraw(false)
            router.refresh()
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/host/pool/knockout" className="text-timber text-sm hover:text-navy block mb-1">← Tournaments</Link>
          <h1 className="text-2xl font-semibold text-navy">{tournament.name}</h1>
          <p className="text-navy/50 text-sm">{date}</p>
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1 ${
          status === 'active'   ? 'bg-green-100 text-green-700' :
          status === 'complete' ? 'bg-navy/10 text-navy/60' :
          'bg-amber-100 text-amber-700'
        }`}>
          {status}
        </span>
      </div>

      {/* ── SETUP PHASE ── */}
      {status === 'setup' && (
        <>
          {/* Player list */}
          <div className="bg-snow-card rounded-2xl border border-timber/15 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-timber/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">
                Entrants ({localEntries.length})
              </h2>
            </div>

            {localEntries.length === 0 ? (
              <p className="text-navy/40 text-sm text-center py-8">Add players below to get started.</p>
            ) : (
              <ul className="divide-y divide-timber/8">
                {localEntries.map((entry, idx) => (
                  <li key={entry.playerId} className="flex items-center px-5 py-3 gap-3">
                    <span className="text-navy/30 text-xs font-bold w-5 text-right">{idx + 1}</span>
                    <span className="flex-1 text-navy text-sm font-medium">{entry.name}</span>
                    <button onClick={() => removePlayer(entry.playerId)}
                      className="text-navy/25 hover:text-rust text-xs px-2 py-1 rounded transition-colors">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add player */}
          <div className="bg-snow-card rounded-2xl border border-timber/15 p-5">
            <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Add Player</h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search existing or type new name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search.trim() && addPlayer(search)}
                className="flex-1 rounded-lg border border-timber/40 px-3 py-2 text-sm text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-smiggins-blue"
              />
              <Button variant="secondary" size="sm" onClick={() => addPlayer(search)} disabled={!search.trim()}>
                Add
              </Button>
            </div>

            {search && (
              <ul className="mt-2 border border-timber/20 rounded-lg overflow-hidden">
                {suggestions.slice(0, 6).map(p => (
                  <li key={p.id}>
                    <button onClick={() => addPlayer(p.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-snow transition-colors flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="text-navy/30 text-xs">existing player</span>
                    </button>
                  </li>
                ))}
                {search.trim() && !suggestions.some(p => p.name.toLowerCase() === search.toLowerCase()) && (
                  <li>
                    <button onClick={() => addPlayer(search)}
                      className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-snow transition-colors flex items-center gap-2">
                      <span className="text-smiggins-blue font-semibold">+ Create "{search.trim()}"</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Generate draw */}
          <div className="flex flex-col items-center gap-3 pt-2">
            {localEntries.length < 2 && (
              <p className="text-navy/40 text-sm">Add at least 2 players to generate the draw.</p>
            )}
            <button
              onClick={handleGenerateDraw}
              disabled={localEntries.length < 2 || drawLoading}
              className="relative overflow-hidden rounded-2xl px-10 py-4 font-black text-white text-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #1567A5 0%, #0a2d5e 100%)',
                boxShadow: '0 8px 32px rgba(21,103,165,0.45)',
                fontFamily: 'var(--font-jost)',
                letterSpacing: '0.05em',
              }}
            >
              {drawLoading ? 'Generating…' : '🎱 GENERATE DRAW'}
            </button>
          </div>
        </>
      )}

      {/* ── ACTIVE / COMPLETE PHASE — BRACKET ── */}
      {(status === 'active' || status === 'complete') && (
        <>
          {/* Tournament winner banner */}
          {tournamentWinner && status !== 'complete' && (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, #E8CC00 0%, #E8820A 100%)' }}>
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-white font-black text-2xl" style={{ fontFamily: 'var(--font-jost)' }}>
                {tournamentWinner.name}
              </div>
              <div className="text-white/80 text-sm mt-1" style={{ fontFamily: 'var(--font-jost)' }}>WINS THE TOURNAMENT!</div>
              <button onClick={handleCompleteTournament} disabled={completingTournament}
                className="mt-4 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-6 py-2 rounded-xl transition-colors">
                {completingTournament ? 'Saving…' : 'Mark Complete & Save Results'}
              </button>
            </div>
          )}

          {status === 'complete' && (
            <div className="rounded-2xl p-6 text-center bg-navy/5 border border-navy/10">
              <div className="text-2xl mb-2">🏆</div>
              <div className="text-navy font-black text-xl" style={{ fontFamily: 'var(--font-jost)' }}>
                Tournament Complete
              </div>
            </div>
          )}

          {/* Round tabs / bracket */}
          {rounds.map(roundNum => {
            const roundMatches = localMatches.filter(m => m.roundNumber === roundNum)
            const isCurrentRound = roundNum === currentRound
            const roundLabel = roundMatches.length === 1 ? 'FINAL' :
                               roundMatches.length === 2 ? 'SEMI-FINALS' :
                               roundMatches.length <= 4  ? 'QUARTER-FINALS' :
                               `ROUND ${roundNum}`

            return (
              <div key={roundNum} className="bg-snow-card rounded-2xl border border-timber/15 overflow-hidden">
                <div className="px-5 py-3 border-b border-timber/10 flex items-center justify-between"
                  style={{ background: isCurrentRound ? 'rgba(21,103,165,0.07)' : 'transparent' }}>
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: isCurrentRound ? '#1567A5' : '#8B7355' }}>
                    {roundLabel}
                  </h2>
                  <span className="text-xs text-navy/40">
                    {roundMatches.filter(m => m.status === 'complete').length}/{roundMatches.length} complete
                  </span>
                </div>

                <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                  {roundMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      tournamentId={tournament.id}
                      onWinnerRecorded={() => {
                        // Update local state optimistically
                        setLocalMatches(prev => prev.map(m =>
                          m.id === match.id ? { ...m, status: 'complete' } : m
                        ))
                        router.refresh()
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Next round button */}
          {allCurrentRoundDone && !isFinalOver && status !== 'complete' && (
            <div className="flex justify-center">
              <Button onClick={handleNextRound} loading={nextRoundLoading} size="lg"
                className="px-10 text-lg font-black tracking-wide">
                Generate Next Round →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
