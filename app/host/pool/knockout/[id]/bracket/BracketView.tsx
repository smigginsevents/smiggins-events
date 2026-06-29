'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── Helper: normalise raw DB row → Match ─────────────────────────────────────
function normalizeMatch(m: any): Match {
  return {
    id: m.id, roundNumber: m.round_number, matchNumber: m.match_number,
    tableNumber: m.table_number, isBye: m.is_bye, status: m.status,
    player1: m.player1 ? { id: m.player1.id, name: m.player1.name } : null,
    player2: m.player2 ? { id: m.player2.id, name: m.player2.name } : null,
    winner:  m.winner  ? { id: m.winner.id,  name: m.winner.name  } : null,
  }
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_H    = 50    // player card height (px)
const CARD_W    = 182   // player card width (px)
const VS_GAP    = 18    // height of "vs" area between cards
const MATCH_GAP = 40    // vertical gap between consecutive matches
const SLOT_H    = CARD_H * 2 + VS_GAP + MATCH_GAP  // 158px per first-round slot

const COL_GAP   = 90    // horizontal space from card right to next card left
const ROUND_W   = CARD_W + COL_GAP  // 272px per round column

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player { id: string; name: string }
interface Match {
  id: string
  roundNumber: number
  matchNumber: number
  tableNumber: number
  isBye: boolean
  status: string
  player1: Player | null
  player2: Player | null
  winner: Player | null
}
interface Tournament { id: string; name: string; eventDate: string; status: string }
interface LayoutMatch extends Match {
  indexInRound: number
  centerY: number
  x: number
}

interface Props {
  tournament: Tournament
  initialMatches: Match[]
  showReveal: boolean
}

// ─── Layout calculation ───────────────────────────────────────────────────────
function buildLayout(matches: Match[]) {
  const byRound: Record<number, Match[]> = {}
  for (const m of matches) {
    if (!byRound[m.roundNumber]) byRound[m.roundNumber] = []
    byRound[m.roundNumber].push(m)
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  if (rounds.length === 0) {
    return { layout: [] as LayoutMatch[], rounds: [], r1Count: 0, totalH: 0, totalW: 0 }
  }

  const r1Count = (byRound[rounds[0]] ?? []).length
  const totalH  = Math.max(r1Count * SLOT_H, SLOT_H)

  const layout: LayoutMatch[] = []
  for (const round of rounds) {
    const rMatches = [...(byRound[round] ?? [])].sort((a, b) => a.matchNumber - b.matchNumber)
    const slotsPerMatch = Math.pow(2, round - 1)

    rMatches.forEach((m, i) => {
      layout.push({
        ...m,
        indexInRound: i,
        centerY: (i + 0.5) * slotsPerMatch * SLOT_H,
        x: (round - 1) * ROUND_W,
      })
    })
  }

  const maxRound = rounds[rounds.length - 1]
  const totalW   = maxRound * ROUND_W + CARD_W

  return { layout, rounds, r1Count, totalH, totalW }
}

// ─── SVG line generation ──────────────────────────────────────────────────────
interface Line { key: string; d: string; delay: number }

function buildLines(layout: LayoutMatch[]): Line[] {
  const lines: Line[] = []
  const byRound: Record<number, LayoutMatch[]> = {}
  for (const m of layout) {
    if (!byRound[m.roundNumber]) byRound[m.roundNumber] = []
    byRound[m.roundNumber].push(m)
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const cur    = rounds[ri]
    const next   = rounds[ri + 1]
    const curMs  = [...(byRound[cur]  ?? [])].sort((a, b) => a.indexInRound - b.indexInRound)
    const nextMs = [...(byRound[next] ?? [])].sort((a, b) => a.indexInRound - b.indexInRound)

    for (let ni = 0; ni < nextMs.length; ni++) {
      const m1     = curMs[ni * 2]
      const m2     = curMs[ni * 2 + 1]
      const parent = nextMs[ni]
      if (!parent || !m1) continue

      const rightX = m1.x + CARD_W
      const midX   = rightX + COL_GAP / 2
      const delay  = 0.15 + ri * 0.35

      if (m2) {
        lines.push({ key: `elbow-${cur}-${ni}`, d: `M ${rightX} ${m1.centerY} H ${midX} V ${m2.centerY} H ${rightX}`, delay })
        lines.push({ key: `connect-${next}-${ni}`, d: `M ${midX} ${parent.centerY} H ${parent.x}`, delay: delay + 0.18 })
      } else {
        lines.push({ key: `single-${cur}-${ni}`, d: `M ${rightX} ${m1.centerY} H ${parent.x}`, delay })
      }
    }
  }

  if (rounds.length > 0) {
    const lastRound  = rounds[rounds.length - 1]
    const finalMatch = (byRound[lastRound] ?? []).find(m => m.indexInRound === 0)
    if (finalMatch) {
      lines.push({
        key: 'champ-line',
        d: `M ${finalMatch.x + CARD_W} ${finalMatch.centerY} H ${finalMatch.x + CARD_W + COL_GAP}`,
        delay: 0.15 + (rounds.length - 1) * 0.35 + 0.18,
      })
    }
  }

  return lines
}

// ─── Full-screen photo background ────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Pool-Comp-webBG.jpg"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
      {/* Deep blue overlay — slightly lighter than leaderboard so photo shows through */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(155deg, rgba(8,18,50,0.68) 0%, rgba(4,10,28,0.62) 100%)',
        }}
      />
    </div>
  )
}

// ─── Top-right branding ───────────────────────────────────────────────────────
function Branding({ name, date }: { name: string; date: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 28,
        right: 36,
        zIndex: 30,
        textAlign: 'right',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 5,
        pointerEvents: 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/smigginslogo-white.png"
        alt="Smiggins"
        style={{ height: 38, objectFit: 'contain', opacity: 0.9 }}
      />
      <div
        style={{
          fontFamily: 'var(--font-jost)',
          fontWeight: 900,
          color: 'white',
          fontSize: 22,
          letterSpacing: '0.2em',
          lineHeight: 1,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        POOL COMP
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.12em',
          marginTop: 2,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 9,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.1em',
        }}
      >
        {date}
      </div>
    </div>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────
function PlayerCard({
  player, isWinner, isLoser, canSelect, onSelect, x, y, visible, initialAnim,
}: {
  player: Player | null; isWinner: boolean; isLoser: boolean; canSelect: boolean
  onSelect: () => void; x: number; y: number; visible: boolean; initialAnim: boolean
}) {
  const hasPlayer = !!player

  const bg = isWinner
    ? 'linear-gradient(135deg, rgba(25,100,170,0.92) 0%, rgba(10,48,115,0.96) 100%)'
    : isLoser
    ? 'rgba(0,0,0,0.32)'
    : hasPlayer
    ? 'rgba(6,14,42,0.78)'
    : 'rgba(4,10,30,0.55)'

  const border = isWinner
    ? 'rgba(96,165,250,0.6)'
    : isLoser
    ? 'rgba(255,255,255,0.04)'
    : hasPlayer
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(255,255,255,0.07)'

  return (
    <motion.button
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isWinner
          ? '0 0 32px rgba(21,103,165,0.28), inset 0 1px 0 rgba(255,255,255,0.1)'
          : hasPlayer && !isLoser
          ? 'inset 0 1px 0 rgba(255,255,255,0.06)'
          : 'none',
        cursor: canSelect && hasPlayer ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 9,
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.2s',
      }}
      initial={initialAnim ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : -20 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={canSelect && hasPlayer
        ? { borderColor: 'rgba(96,165,250,0.55)', boxShadow: '0 0 20px rgba(96,165,250,0.18), inset 0 1px 0 rgba(255,255,255,0.1)' }
        : undefined}
      whileTap={canSelect && hasPlayer ? { scale: 0.97 } : undefined}
      onClick={canSelect && hasPlayer ? onSelect : undefined}
    >
      {isWinner && (
        <span style={{ fontSize: 11, color: 'rgba(96,165,250,0.9)', flexShrink: 0, lineHeight: 1 }}>✓</span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 14,
          fontWeight: isWinner ? 700 : hasPlayer ? 500 : 400,
          color: isLoser
            ? 'rgba(255,255,255,0.18)'
            : hasPlayer
            ? 'rgba(255,255,255,0.92)'
            : 'rgba(255,255,255,0.2)',
          letterSpacing: hasPlayer ? '0.01em' : '0.08em',
          textDecoration: isLoser ? 'line-through' : 'none',
          textDecorationColor: 'rgba(255,255,255,0.15)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
          textShadow: hasPlayer && !isLoser ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {player?.name ?? (canSelect ? '—' : 'TBD')}
      </span>
    </motion.button>
  )
}

// ─── Single bracket match ─────────────────────────────────────────────────────
function BracketMatchCard({
  match, visible, initialAnim, onSelectWinner,
}: {
  match: LayoutMatch; visible: boolean; initialAnim: boolean
  onSelectWinner: (match: LayoutMatch, player: Player) => void
}) {
  const isComplete = match.status === 'complete' || !!match.winner
  const canSelect  = !isComplete && !!match.player1 && (!!match.player2 || match.isBye)

  const p1Win = isComplete && match.winner?.id === match.player1?.id
  const p2Win = isComplete && match.winner?.id === match.player2?.id

  const p1Top = match.centerY - CARD_H - VS_GAP / 2
  const p2Top = match.centerY + VS_GAP / 2

  return (
    <>
      <PlayerCard
        player={match.player1}
        isWinner={p1Win}
        isLoser={isComplete && !p1Win}
        canSelect={canSelect}
        onSelect={() => match.player1 && onSelectWinner(match, match.player1)}
        x={match.x} y={p1Top} visible={visible} initialAnim={initialAnim}
      />

      {visible && (
        <motion.div
          initial={initialAnim ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          style={{
            position: 'absolute',
            left: match.x,
            top: match.centerY - VS_GAP / 2,
            width: CARD_W,
            height: VS_GAP,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontFamily: 'var(--font-jost)', fontSize: 9, fontStyle: 'italic', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em' }}>
            {match.isBye ? 'bye' : 'vs'}
          </span>
          {!match.isBye && (
            <span style={{
              fontFamily: 'var(--font-jost)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em',
              color: match.tableNumber === 1 ? '#E8820A' : '#C8A800',
              background: match.tableNumber === 1 ? 'rgba(232,130,10,0.15)' : 'rgba(200,168,0,0.15)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              T{match.tableNumber}
            </span>
          )}
        </motion.div>
      )}

      {!match.isBye && (
        <PlayerCard
          player={match.player2}
          isWinner={p2Win}
          isLoser={isComplete && !p2Win}
          canSelect={canSelect}
          onSelect={() => match.player2 && onSelectWinner(match, match.player2)}
          x={match.x} y={p2Top} visible={visible} initialAnim={initialAnim}
        />
      )}
    </>
  )
}

// ─── Main BracketView ─────────────────────────────────────────────────────────
export function BracketView({ tournament, initialMatches, showReveal }: Props) {
  type Phase = 'intro' | 'revealing' | 'lines' | 'bracket'

  const [matches, setMatches]        = useState<Match[]>(initialMatches)
  const [phase, setPhase]            = useState<Phase>(showReveal ? 'intro' : 'bracket')
  const [revealedCount, setRevealed] = useState(showReveal ? 0 : 9999)
  const [svgKey, setSvgKey]          = useState(0)
  const [selecting, setSelecting]    = useState(false)
  const [scale, setScale]            = useState(1)
  const containerRef                 = useRef<HTMLDivElement>(null)

  // ── Late arrival state ─────────────────────────────────────────────────────
  const [showLatePanel, setShowLatePanel] = useState(false)
  const [lateQueue, setLateQueue]         = useState<Player | null>(null)   // one unmatched player
  const [lateSearch, setLateSearch]       = useState('')
  const [lateAdding, setLateAdding]       = useState(false)
  const [allPlayers, setAllPlayers]       = useState<Player[]>([])
  const lateInputRef                      = useRef<HTMLInputElement>(null)

  // Fetch all known players when panel opens
  useEffect(() => {
    if (!showLatePanel || allPlayers.length > 0) return
    const supabase = createClient()
    supabase.from('pool_players').select('id, name').order('name').then(({ data }) => {
      if (data) setAllPlayers(data.map((p: any) => ({ id: p.id, name: p.name })))
    })
  }, [showLatePanel, allPlayers.length])

  useEffect(() => {
    if (showLatePanel) setTimeout(() => lateInputRef.current?.focus(), 180)
  }, [showLatePanel])

  // ── Champion ───────────────────────────────────────────────────────────────
  const champion = useMemo<Player | null>(() => {
    if (matches.length === 0) return null
    const maxRound  = Math.max(...matches.map(m => m.roundNumber))
    const lastRound = matches.filter(m => m.roundNumber === maxRound)
    if (lastRound.length !== 1) return null
    return lastRound[0].winner ?? null
  }, [matches])

  // ── Reveal timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showReveal) return
    const r1 = matches.filter(m => m.roundNumber === 1)

    if (phase === 'intro') {
      const t = setTimeout(() => setPhase('revealing'), 2000)
      return () => clearTimeout(t)
    }
    if (phase === 'revealing') {
      if (revealedCount < r1.length) {
        const t = setTimeout(() => setRevealed(c => c + 1), 1800)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => {
        setPhase('lines')
        const t2 = setTimeout(() => setPhase('bracket'), 1300)
        return () => clearTimeout(t2)
      }, 700)
      return () => clearTimeout(t)
    }
  }, [showReveal, phase, revealedCount, matches])

  // ── Layout ─────────────────────────────────────────────────────────────────
  const { layout, rounds, r1Count, totalH, totalW } = useMemo(
    () => buildLayout(matches), [matches],
  )

  const lines       = useMemo(() => buildLines(layout), [layout])
  const linesVisible = phase === 'lines' || phase === 'bracket'

  function isVisible(m: LayoutMatch) {
    if (m.roundNumber === 1) return revealedCount > m.indexInRound
    return linesVisible
  }

  // ── Scale-to-fit: auto-scales bracket to fill the display ─────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || !totalW || !totalH) return

    const obs = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect()
      // Allow upscaling up to 2×, scale down as needed
      const sx = width  / (totalW + 60)
      const sy = height / (totalH + 60)
      setScale(Math.min(2.0, sx, sy))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [totalW, totalH])

  // ── Winner selection ───────────────────────────────────────────────────────
  const handleSelectWinner = useCallback(
    async (match: LayoutMatch, player: Player) => {
      if (selecting) return
      setSelecting(true)

      const updated = matches.map(m =>
        m.id === match.id ? { ...m, winner: player, status: 'complete' } : m,
      )
      setMatches(updated)

      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('pool_matches')
          .update({ winner_id: player.id, status: 'complete' })
          .eq('id', match.id)
        if (error) throw new Error(error.message)

        const roundMs = updated.filter(m => m.roundNumber === match.roundNumber)
        const allDone = roundMs.every(m => m.status === 'complete' || m.isBye)

        if (allDone) {
          const winners = roundMs
            .sort((a, b) => a.matchNumber - b.matchNumber)
            .map(m => m.winner!).filter(Boolean)

          if (winners.length === 1) {
            await supabase.from('pool_tournaments').update({ status: 'complete' }).eq('id', tournament.id)
          } else if (winners.length > 1) {
            await spawnNextRound(supabase, match.roundNumber, updated, winners)
          }
        }
      } catch (e: any) {
        alert('Error recording winner: ' + e.message)
        setMatches(matches)
      } finally {
        setSelecting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecting, matches, tournament.id],
  )

  async function spawnNextRound(
    supabase: ReturnType<typeof createClient>,
    completedRound: number,
    currentMatches: Match[],
    winners: Player[],
  ) {
    const maxMatch  = Math.max(...currentMatches.map(m => m.matchNumber))
    const nextRound = completedRound + 1
    const rows = []

    for (let i = 0; i < winners.length; i += 2) {
      const isBye = i + 1 >= winners.length
      rows.push({
        tournament_id: tournament.id,
        round_number:  nextRound,
        match_number:  maxMatch + Math.floor(i / 2) + 1,
        table_number:  (Math.floor(i / 2) % 2) + 1,
        player1_id:    winners[i].id,
        player2_id:    isBye ? null : winners[i + 1].id,
        is_bye:        isBye,
        status:        isBye ? 'complete' : 'pending',
        winner_id:     isBye ? winners[i].id : null,
      })
    }

    const { data, error } = await supabase
      .from('pool_matches').insert(rows)
      .select(`
        id, round_number, match_number, table_number, is_bye, status, winner_id,
        player1:pool_players!pool_matches_player1_id_fkey(id, name),
        player2:pool_players!pool_matches_player2_id_fkey(id, name),
        winner:pool_players!pool_matches_winner_id_fkey(id, name)
      `)
    if (error) throw new Error(error.message)

    const newMatches: Match[] = (data ?? []).map((m: any) => ({
      id: m.id, roundNumber: m.round_number, matchNumber: m.match_number,
      tableNumber: m.table_number, isBye: m.is_bye, status: m.status,
      player1: m.player1 ? { id: m.player1.id, name: m.player1.name } : null,
      player2: m.player2 ? { id: m.player2.id, name: m.player2.name } : null,
      winner:  m.winner  ? { id: m.winner.id,  name: m.winner.name  } : null,
    }))

    setMatches(prev => [...prev, ...newMatches])
    setTimeout(() => setSvgKey(k => k + 1), 80)
  }

  // ── Late arrival: add player ───────────────────────────────────────────────
  async function handleAddLatePlayer(playerName: string) {
    const trimmed = playerName.trim()
    if (!trimmed || lateAdding) return
    setLateAdding(true)
    setLateSearch('')

    try {
      const supabase = createClient()

      // Get or create player
      let player: Player
      const { data: existing } = await supabase
        .from('pool_players').select('id, name').ilike('name', trimmed).single()
      if (existing) {
        player = existing
      } else {
        const { data: created, error: ce } = await supabase
          .from('pool_players').insert({ name: trimmed }).select('id, name').single()
        if (ce) throw new Error(ce.message)
        player = created
      }

      // Add tournament entry (ignore duplicate)
      await supabase.from('pool_tournament_entries')
        .insert({ tournament_id: tournament.id, player_id: player.id })
        .select()

      if (lateQueue) {
        // Pair with waiting player → create a new match
        const currentMatches = matches
        const activeRound = currentMatches
          .filter(m => m.status === 'pending' && !m.isBye)
          .reduce<number>((min, m) => Math.min(min, m.roundNumber), Infinity)
        const targetRound = isFinite(activeRound)
          ? activeRound
          : Math.max(...currentMatches.map(m => m.roundNumber))
        const maxMatch = Math.max(...currentMatches.map(m => m.matchNumber))
        const tableNum = (maxMatch % 2) + 1

        const { data, error } = await supabase.from('pool_matches').insert({
          tournament_id: tournament.id,
          round_number:  targetRound,
          match_number:  maxMatch + 1,
          table_number:  tableNum,
          player1_id:    lateQueue.id,
          player2_id:    player.id,
          is_bye:        false,
          status:        'pending',
          winner_id:     null,
        }).select(`
          id, round_number, match_number, table_number, is_bye, status, winner_id,
          player1:pool_players!pool_matches_player1_id_fkey(id, name),
          player2:pool_players!pool_matches_player2_id_fkey(id, name),
          winner:pool_players!pool_matches_winner_id_fkey(id, name)
        `)

        if (error) throw new Error(error.message)
        const newMatch = normalizeMatch(data[0])
        setMatches(prev => [...prev, newMatch])
        setLateQueue(null)
        setTimeout(() => setSvgKey(k => k + 1), 80)
      } else {
        // No partner yet — place in queue
        setLateQueue(player)
      }
    } catch (e: any) {
      alert('Error adding late player: ' + e.message)
    } finally {
      setLateAdding(false)
      lateInputRef.current?.focus()
    }
  }

  // ── Late arrival: give queued player a bye ─────────────────────────────────
  async function handleLateBye() {
    if (!lateQueue || lateAdding) return
    setLateAdding(true)
    try {
      const supabase = createClient()
      const currentMatches = matches
      const activeRound = currentMatches
        .filter(m => m.status === 'pending' && !m.isBye)
        .reduce<number>((min, m) => Math.min(min, m.roundNumber), Infinity)
      const targetRound = isFinite(activeRound)
        ? activeRound
        : Math.max(...currentMatches.map(m => m.roundNumber))
      const maxMatch = Math.max(...currentMatches.map(m => m.matchNumber))

      const { data, error } = await supabase.from('pool_matches').insert({
        tournament_id: tournament.id,
        round_number:  targetRound,
        match_number:  maxMatch + 1,
        table_number:  1,
        player1_id:    lateQueue.id,
        player2_id:    null,
        is_bye:        true,
        status:        'complete',
        winner_id:     lateQueue.id,
      }).select(`
        id, round_number, match_number, table_number, is_bye, status, winner_id,
        player1:pool_players!pool_matches_player1_id_fkey(id, name),
        player2:pool_players!pool_matches_player2_id_fkey(id, name),
        winner:pool_players!pool_matches_winner_id_fkey(id, name)
      `)

      if (error) throw new Error(error.message)
      const newMatch = normalizeMatch(data[0])
      setMatches(prev => [...prev, newMatch])
      setLateQueue(null)
      setTimeout(() => setSvgKey(k => k + 1), 80)

      // Check if round is now complete (all matches done)
      const allMatches = [...matches, newMatch]
      const roundMs = allMatches.filter(m => m.roundNumber === targetRound)
      const allDone = roundMs.every(m => m.status === 'complete' || m.isBye)
      if (allDone) {
        const winners = roundMs
          .sort((a, b) => a.matchNumber - b.matchNumber)
          .map(m => m.winner!).filter(Boolean)
        if (winners.length === 1) {
          await supabase.from('pool_tournaments').update({ status: 'complete' }).eq('id', tournament.id)
        } else if (winners.length > 1) {
          await spawnNextRound(supabase, targetRound, allMatches, winners)
        }
      }
    } catch (e: any) {
      alert('Error giving bye: ' + e.message)
    } finally {
      setLateAdding(false)
    }
  }

  // ── Derived positions ──────────────────────────────────────────────────────
  const maxRound   = rounds.length > 0 ? rounds[rounds.length - 1] : 1
  const finalMatch = layout.find(m => m.roundNumber === maxRound && m.indexInRound === 0)
  const champX     = (finalMatch?.x ?? 0) + CARD_W + COL_GAP
  const champY     = finalMatch?.centerY ?? 0

  const formattedDate = new Date(tournament.eventDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const roundLabel = (count: number, round: number) =>
    count === 1 ? 'FINAL'
    : count === 2 ? 'SEMI-FINALS'
    : count <= 4 ? 'QTR-FINALS'
    : `ROUND ${round}`

  // ── Intro phase ────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Background />
        <Branding name={tournament.name} date={formattedDate} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          <motion.div
            animate={{ scale: [1, 1.045, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(3rem, 10vw, 7rem)',
              color: 'white', lineHeight: 1,
              textShadow: '0 4px 40px rgba(0,0,0,0.6)',
            }}
          >
            THE DRAW
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{
              fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.4)',
              fontSize: '1.1rem', marginTop: 12, letterSpacing: '0.35em',
            }}
          >
            IS ABOUT TO BEGIN
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Main bracket ───────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, overflow: 'hidden' }}>
      <Background />
      <Branding name={tournament.name} date={formattedDate} />

      {/* Exit button — subtle top left */}
      <Link
        href={`/host/pool/knockout/${tournament.id}`}
        style={{
          position: 'fixed', top: 18, left: 20, zIndex: 40,
          fontFamily: 'var(--font-jost)', fontSize: 11,
          color: 'rgba(255,255,255,0.2)', textDecoration: 'none',
          letterSpacing: '0.06em', padding: '5px 10px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(8px)',
          transition: 'color 0.2s',
        }}
      >
        ← Exit
      </Link>

      {/* Champion overlay banner */}
      <AnimatePresence>
        {champion && (
          <motion.div
            key="champ-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            style={{
              position: 'fixed', top: 18, left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 40,
              background: 'linear-gradient(135deg, #E8CC00, #E8820A)',
              borderRadius: 24,
              padding: '7px 22px',
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              color: 'white', fontSize: 14, letterSpacing: '0.04em',
              boxShadow: '0 4px 24px rgba(232,204,0,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            🏆 &nbsp;{champion.name} &nbsp;— CHAMPION
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bracket container — centred, auto-scaled ───────────────────────── */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          top: 80,    // leave room for overlays
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: totalW,
            height: totalH + 44,   // +44 for round labels above
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Round labels */}
          {rounds.map(round => {
            const count = layout.filter(m => m.roundNumber === round).length
            return (
              <div key={round} style={{
                position: 'absolute', left: (round - 1) * ROUND_W, top: 0,
                width: CARD_W, textAlign: 'center',
                fontFamily: 'var(--font-jost)', fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.25)', letterSpacing: '0.22em',
                textShadow: '0 1px 6px rgba(0,0,0,0.4)',
              }}>
                {roundLabel(count, round)}
              </div>
            )
          })}

          {/* Champion column label */}
          {finalMatch && (
            <div style={{
              position: 'absolute', left: champX, top: 0,
              width: CARD_W, textAlign: 'center',
              fontFamily: 'var(--font-jost)', fontSize: 10, fontWeight: 700,
              color: 'rgba(232,204,0,0.35)', letterSpacing: '0.22em',
            }}>
              CHAMPION
            </div>
          )}

          {/* Inner bracket area (offset by label height) */}
          <div style={{ position: 'absolute', left: 0, top: 44, width: totalW, height: totalH }}>

            {/* SVG lines */}
            <svg
              key={svgKey}
              style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
              width={totalW + 120}
              height={totalH + 60}
            >
              {linesVisible && lines.map(line => (
                <motion.path
                  key={line.key}
                  d={line.d}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: { duration: 0.55, delay: line.delay, ease: 'easeOut' },
                    opacity: { duration: 0.22, delay: line.delay },
                  }}
                />
              ))}
            </svg>

            {/* Match cards */}
            {layout.map(match => (
              <BracketMatchCard
                key={match.id}
                match={match}
                visible={isVisible(match)}
                initialAnim={showReveal || match.roundNumber > 1}
                onSelectWinner={handleSelectWinner}
              />
            ))}

            {/* Champion card */}
            <AnimatePresence>
              {champion && finalMatch && (
                <motion.div
                  key="champion-card"
                  initial={{ opacity: 0, scale: 0.8, x: 18 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    left: champX,
                    top: champY - CARD_H / 2 - 24,
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-jost)', fontSize: 10, fontWeight: 700,
                    color: '#E8CC00', letterSpacing: '0.24em', marginBottom: 7,
                    textShadow: '0 0 20px rgba(232,204,0,0.6)',
                  }}>
                    🏆 CHAMPION
                  </div>
                  <div style={{
                    width: CARD_W, height: CARD_H, borderRadius: 9,
                    background: 'linear-gradient(135deg, #E8CC00 0%, #E8820A 100%)',
                    boxShadow: '0 0 60px rgba(232,204,0,0.38), 0 0 20px rgba(232,130,10,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 16px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-jost)', fontSize: 15, fontWeight: 900,
                      color: 'white', letterSpacing: '0.02em',
                      textShadow: '0 1px 6px rgba(0,0,0,0.3)',
                    }}>
                      {champion.name}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hints */}
      {phase === 'bracket' && !champion && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
          style={{
            position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'var(--font-jost)', fontSize: 11, color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.06em', pointerEvents: 'none',
          }}
        >
          Tap a player to record the winner
        </motion.div>
      )}

      {phase === 'revealing' && revealedCount < r1Count && (
        <motion.div
          animate={{ opacity: [0.25, 0.75, 0.25] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'var(--font-jost)', fontSize: 11, color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.28em', pointerEvents: 'none',
          }}
        >
          DRAWING…
        </motion.div>
      )}

      {/* ── Late arrival FAB ──────────────────────────────────────────────── */}
      {phase === 'bracket' && !champion && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.5, type: 'spring', stiffness: 280, damping: 22 }}
          onClick={() => setShowLatePanel(p => !p)}
          whileHover={{ scale: 1.08, boxShadow: '0 8px 32px rgba(21,103,165,0.45)' }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'fixed', bottom: 24, right: 28, zIndex: 40,
            background: showLatePanel
              ? 'rgba(6,14,42,0.9)'
              : 'linear-gradient(135deg, rgba(21,80,165,0.85) 0%, rgba(8,28,88,0.92) 100%)',
            border: `1px solid ${showLatePanel ? 'rgba(255,255,255,0.18)' : 'rgba(96,165,250,0.3)'}`,
            borderRadius: 14,
            padding: '10px 20px',
            backdropFilter: 'blur(16px)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-jost)', fontWeight: 700,
            fontSize: '0.78rem', letterSpacing: '0.14em',
            color: showLatePanel ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.88)',
            boxShadow: showLatePanel ? 'none' : '0 4px 24px rgba(21,103,165,0.3)',
            transition: 'background 0.2s, color 0.2s, border-color 0.2s',
          }}
        >
          {showLatePanel ? (
            <><span style={{ fontSize: '0.9rem' }}>✕</span><span>CLOSE</span></>
          ) : (
            <><span style={{ fontSize: '1rem' }}>+</span><span>LATE ARRIVAL</span></>
          )}
          {lateQueue && !showLatePanel && (
            <span style={{
              background: '#E8820A', color: 'white', borderRadius: '50%',
              width: 18, height: 18, fontSize: '0.6rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 2,
            }}>1</span>
          )}
        </motion.button>
      )}

      {/* ── Late arrival slide-up panel ───────────────────────────────────── */}
      <AnimatePresence>
        {showLatePanel && phase === 'bracket' && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', bottom: 80, right: 28, zIndex: 39,
              width: 380,
              background: 'rgba(4,10,30,0.94)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18,
              padding: '24px 24px 20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              fontFamily: 'var(--font-jost)',
            }}
          >
            {/* Panel header */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.35)', marginBottom: 4,
              }}>
                LATE ARRIVAL
              </div>
              <div style={{
                fontSize: '1.1rem', fontWeight: 800,
                color: 'rgba(255,255,255,0.88)',
                letterSpacing: '0.03em',
              }}>
                Add Player to Draw
              </div>
              <div style={{
                fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)',
                marginTop: 5, lineHeight: 1.5,
              }}>
                {lateQueue
                  ? `Waiting for a partner for ${lateQueue.name} — add a second player to create a match, or give them a bye.`
                  : 'Add a player to the draw. They\'ll be paired when a second late arrival joins.'}
              </div>
            </div>

            {/* Waiting player badge */}
            <AnimatePresence>
              {lateQueue && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    background: 'rgba(232,130,10,0.15)',
                    border: '1px solid rgba(232,130,10,0.3)',
                    borderRadius: 10, padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(232,130,10,0.7)', letterSpacing: '0.15em', marginBottom: 2 }}>
                      WAITING FOR PARTNER
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                      {lateQueue.name}
                    </div>
                  </div>
                  <button
                    onClick={handleLateBye}
                    disabled={lateAdding}
                    style={{
                      background: 'rgba(232,130,10,0.2)', border: '1px solid rgba(232,130,10,0.4)',
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                      fontFamily: 'var(--font-jost)', fontWeight: 700,
                      fontSize: '0.7rem', letterSpacing: '0.12em',
                      color: 'rgba(232,130,10,0.9)',
                    }}
                  >
                    GIVE BYE
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={lateInputRef}
                  type="text"
                  placeholder={lateQueue ? 'Add second player…' : 'Enter player name…'}
                  value={lateSearch}
                  onChange={e => setLateSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lateSearch.trim() && handleAddLatePlayer(lateSearch)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 9,
                    padding: '11px 16px',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-jost)', fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(96,165,250,0.55)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.14)' }}
                />
                <button
                  onClick={() => lateSearch.trim() && handleAddLatePlayer(lateSearch)}
                  disabled={!lateSearch.trim() || lateAdding}
                  style={{
                    background: 'rgba(21,103,165,0.65)',
                    border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: 9, padding: '0 18px',
                    fontFamily: 'var(--font-jost)', fontWeight: 700,
                    fontSize: '0.78rem', letterSpacing: '0.1em',
                    color: 'white', cursor: 'pointer',
                    opacity: !lateSearch.trim() || lateAdding ? 0.4 : 1,
                    transition: 'opacity 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lateAdding ? '…' : lateQueue ? 'PAIR' : 'ADD'}
                </button>
              </div>

              {/* Suggestions */}
              <AnimatePresence>
                {lateSearch.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute', top: '110%', left: 0, right: 56,
                      background: 'rgba(6,14,42,0.97)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 9, overflow: 'hidden', zIndex: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {allPlayers
                      .filter(p => p.name.toLowerCase().includes(lateSearch.toLowerCase()))
                      .filter(p => !matches.some(m => m.player1?.id === p.id || m.player2?.id === p.id))
                      .slice(0, 4)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAddLatePlayer(p.name)}
                          style={{
                            width: '100%', textAlign: 'left', background: 'none',
                            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                            cursor: 'pointer', padding: '10px 14px',
                            fontFamily: 'var(--font-jost)', fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.78)',
                            display: 'flex', justifyContent: 'space-between',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span>{p.name}</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em' }}>RETURNING</span>
                        </button>
                      ))
                    }
                    {lateSearch.trim() && !allPlayers.some(p => p.name.toLowerCase() === lateSearch.toLowerCase()) && (
                      <button
                        onClick={() => handleAddLatePlayer(lateSearch)}
                        style={{
                          width: '100%', textAlign: 'left', background: 'none',
                          border: 'none', cursor: 'pointer', padding: '10px 14px',
                          fontFamily: 'var(--font-jost)', fontSize: '0.9rem',
                          color: 'rgba(96,165,250,0.85)',
                          display: 'flex', gap: 8, alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span>+</span><span>Add &ldquo;{lateSearch.trim()}&rdquo; as new player</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
