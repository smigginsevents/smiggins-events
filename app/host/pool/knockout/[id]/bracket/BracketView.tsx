'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_H   = 48    // player card height (px)
const CARD_W   = 178   // player card width (px)
const VS_GAP   = 16    // height of "vs" area between cards
const MATCH_GAP = 36   // vertical gap between consecutive matches
const SLOT_H   = CARD_H * 2 + VS_GAP + MATCH_GAP  // 148px per first-round slot

const COL_GAP  = 86    // horizontal space from card right to next card left
const ROUND_W  = CARD_W + COL_GAP  // 264px per round column

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
  const totalH   = Math.max(r1Count * SLOT_H, SLOT_H)

  const layout: LayoutMatch[] = []
  for (const round of rounds) {
    const rMatches = [...(byRound[round] ?? [])].sort((a, b) => a.matchNumber - b.matchNumber)
    const slotsPerMatch = Math.pow(2, round - 1)

    rMatches.forEach((m, i) => {
      layout.push({
        ...m,
        indexInRound: i,
        // center Y: (i + 0.5) * slotsPerMatch * SLOT_H
        centerY: (i + 0.5) * slotsPerMatch * SLOT_H,
        x: (round - 1) * ROUND_W,
      })
    })
  }

  const maxRound = rounds[rounds.length - 1]
  // Total width includes the champion card column
  const totalW = maxRound * ROUND_W + CARD_W

  return { layout, rounds, r1Count, totalH, totalW }
}

// ─── SVG line generation ──────────────────────────────────────────────────────
interface Line {
  key: string
  d: string
  delay: number
}

function buildLines(layout: LayoutMatch[]): Line[] {
  const lines: Line[] = []
  const byRound: Record<number, LayoutMatch[]> = {}
  for (const m of layout) {
    if (!byRound[m.roundNumber]) byRound[m.roundNumber] = []
    byRound[m.roundNumber].push(m)
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const cur  = rounds[ri]
    const next = rounds[ri + 1]
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
        // Elbow: m1 right → midX (H), down to m2 level (V), back to m2 right (H)
        lines.push({
          key: `elbow-${cur}-${ni}`,
          d: `M ${rightX} ${m1.centerY} H ${midX} V ${m2.centerY} H ${rightX}`,
          delay,
        })
        // Junction midX → parent left
        lines.push({
          key: `connect-${next}-${ni}`,
          d: `M ${midX} ${parent.centerY} H ${parent.x}`,
          delay: delay + 0.18,
        })
      } else {
        // Bye / single — straight through
        lines.push({
          key: `single-${cur}-${ni}`,
          d: `M ${rightX} ${m1.centerY} H ${parent.x}`,
          delay,
        })
      }
    }
  }

  // Champion line from final match → champion card slot
  if (rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1]
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

// ─── Deterministic star field ─────────────────────────────────────────────────
function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        x: ((i * 14.3 + 5.7) % 100),
        y: ((i * 7.7 + 11.3) % 100),
        r: (i % 3) + 1,
        o: (((i * 19) % 55) + 10) / 100,
      })),
    [],
  )

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {stars.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            borderRadius: '50%',
            background: 'white',
            opacity: s.o,
          }}
        />
      ))}
    </div>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────
function PlayerCard({
  player,
  isWinner,
  isLoser,
  canSelect,
  onSelect,
  x,
  y,
  visible,
  initialAnim,
}: {
  player: Player | null
  isWinner: boolean
  isLoser: boolean
  canSelect: boolean
  onSelect: () => void
  x: number
  y: number
  visible: boolean
  initialAnim: boolean
}) {
  const hasPlayer = !!player

  const bg = isWinner
    ? 'linear-gradient(135deg, rgba(30,110,175,0.9) 0%, rgba(12,55,120,0.95) 100%)'
    : isLoser
    ? 'rgba(0,0,0,0.18)'
    : hasPlayer
    ? 'rgba(255,255,255,0.065)'
    : 'rgba(255,255,255,0.025)'

  const borderColor = isWinner
    ? 'rgba(96,165,250,0.55)'
    : isLoser
    ? 'rgba(255,255,255,0.04)'
    : hasPlayer
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(255,255,255,0.06)'

  return (
    <motion.button
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 7,
        border: `1px solid ${borderColor}`,
        background: bg,
        boxShadow: isWinner ? '0 0 28px rgba(21,103,165,0.22)' : 'none',
        cursor: canSelect && hasPlayer ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.2s ease',
      }}
      initial={initialAnim ? { opacity: 0, x: -18 } : false}
      animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : -18 }}
      transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={canSelect && hasPlayer ? { borderColor: 'rgba(96,165,250,0.5)', backgroundColor: 'rgba(255,255,255,0.11)' } : undefined}
      whileTap={canSelect && hasPlayer ? { scale: 0.97 } : undefined}
      onClick={canSelect && hasPlayer ? onSelect : undefined}
    >
      {isWinner && (
        <span style={{ fontSize: 10, color: 'rgba(96,165,250,0.85)', flexShrink: 0, lineHeight: 1 }}>✓</span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 13,
          fontWeight: isWinner ? 700 : hasPlayer ? 500 : 400,
          color: isLoser
            ? 'rgba(255,255,255,0.18)'
            : hasPlayer
            ? 'rgba(255,255,255,0.9)'
            : 'rgba(255,255,255,0.18)',
          letterSpacing: hasPlayer ? '0.01em' : '0.06em',
          textDecoration: isLoser ? 'line-through' : 'none',
          textDecorationColor: 'rgba(255,255,255,0.15)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
        }}
      >
        {player?.name ?? (canSelect ? '—' : 'TBD')}
      </span>
    </motion.button>
  )
}

// ─── Single bracket match (2 cards + VS badge) ────────────────────────────────
function BracketMatchCard({
  match,
  visible,
  initialAnim,
  onSelectWinner,
}: {
  match: LayoutMatch
  visible: boolean
  initialAnim: boolean
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
      {/* Player 1 */}
      <PlayerCard
        player={match.player1}
        isWinner={p1Win}
        isLoser={isComplete && !p1Win}
        canSelect={canSelect}
        onSelect={() => match.player1 && onSelectWinner(match, match.player1)}
        x={match.x}
        y={p1Top}
        visible={visible}
        initialAnim={initialAnim}
      />

      {/* VS / table badge */}
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
            padding: '0 14px',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-jost)',
              fontSize: 9,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.06em',
            }}
          >
            {match.isBye ? 'bye' : 'vs'}
          </span>
          {!match.isBye && (
            <span
              style={{
                fontFamily: 'var(--font-jost)',
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: match.tableNumber === 1 ? '#E8820A' : '#C8A800',
                background: match.tableNumber === 1 ? 'rgba(232,130,10,0.12)' : 'rgba(200,168,0,0.12)',
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              T{match.tableNumber}
            </span>
          )}
        </motion.div>
      )}

      {/* Player 2 (hidden for bye) */}
      {!match.isBye && (
        <PlayerCard
          player={match.player2}
          isWinner={p2Win}
          isLoser={isComplete && !p2Win}
          canSelect={canSelect}
          onSelect={() => match.player2 && onSelectWinner(match, match.player2)}
          x={match.x}
          y={p2Top}
          visible={visible}
          initialAnim={initialAnim}
        />
      )}
    </>
  )
}

// ─── Main BracketView ─────────────────────────────────────────────────────────
export function BracketView({ tournament, initialMatches, showReveal }: Props) {
  type Phase = 'intro' | 'revealing' | 'lines' | 'bracket'

  const [matches, setMatches]         = useState<Match[]>(initialMatches)
  const [phase, setPhase]             = useState<Phase>(showReveal ? 'intro' : 'bracket')
  const [revealedCount, setRevealed]  = useState(showReveal ? 0 : 9999)
  // Incremented each time new rounds are added — forces SVG re-mount for new line animations
  const [svgKey, setSvgKey]           = useState(0)
  const [selecting, setSelecting]     = useState(false)

  // ── Derive champion from matches ───────────────────────────────────────────
  const champion = useMemo<Player | null>(() => {
    if (matches.length === 0) return null
    const maxRound  = Math.max(...matches.map(m => m.roundNumber))
    const lastRound = matches.filter(m => m.roundNumber === maxRound)
    if (lastRound.length !== 1) return null
    return lastRound[0].winner ?? null
  }, [matches])

  // ── Reveal timer sequence ──────────────────────────────────────────────────
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
      // All revealed → draw lines
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
    () => buildLayout(matches),
    [matches],
  )

  const lines = useMemo(() => buildLines(layout), [layout])

  const linesVisible = phase === 'lines' || phase === 'bracket'

  function isVisible(m: LayoutMatch) {
    if (m.roundNumber === 1) return revealedCount > m.indexInRound
    return linesVisible
  }

  // ── Winner selection ───────────────────────────────────────────────────────
  const handleSelectWinner = useCallback(
    async (match: LayoutMatch, player: Player) => {
      if (selecting) return
      setSelecting(true)

      // Optimistic update
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

        // Check round completion
        const roundMs = updated.filter(m => m.roundNumber === match.roundNumber)
        const allDone = roundMs.every(m => m.status === 'complete' || m.isBye)

        if (allDone) {
          const winners = roundMs
            .sort((a, b) => a.matchNumber - b.matchNumber)
            .map(m => m.winner!)
            .filter(Boolean)

          if (winners.length === 1) {
            // Champion — tournament over
            await supabase
              .from('pool_tournaments')
              .update({ status: 'complete' })
              .eq('id', tournament.id)
          } else if (winners.length > 1) {
            await spawnNextRound(supabase, match.roundNumber, updated, winners)
          }
        }
      } catch (e: any) {
        alert('Error recording winner: ' + e.message)
        setMatches(matches) // revert
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
        tournament_id:  tournament.id,
        round_number:   nextRound,
        match_number:   maxMatch + Math.floor(i / 2) + 1,
        table_number:   (Math.floor(i / 2) % 2) + 1,
        player1_id:     winners[i].id,
        player2_id:     isBye ? null : winners[i + 1].id,
        is_bye:         isBye,
        status:         isBye ? 'complete' : 'pending',
        winner_id:      isBye ? winners[i].id : null,
      })
    }

    const { data, error } = await supabase
      .from('pool_matches')
      .insert(rows)
      .select(`
        id, round_number, match_number, table_number, is_bye, status, winner_id,
        player1:pool_players!pool_matches_player1_id_fkey(id, name),
        player2:pool_players!pool_matches_player2_id_fkey(id, name),
        winner:pool_players!pool_matches_winner_id_fkey(id, name)
      `)
    if (error) throw new Error(error.message)

    const newMatches: Match[] = (data ?? []).map((m: any) => ({
      id:          m.id,
      roundNumber: m.round_number,
      matchNumber: m.match_number,
      tableNumber: m.table_number,
      isBye:       m.is_bye,
      status:      m.status,
      player1:     m.player1 ? { id: m.player1.id, name: m.player1.name } : null,
      player2:     m.player2 ? { id: m.player2.id, name: m.player2.name } : null,
      winner:      m.winner  ? { id: m.winner.id,  name: m.winner.name  } : null,
    }))

    setMatches(prev => [...prev, ...newMatches])
    // Small delay so layout recalculates before re-mounting SVG
    setTimeout(() => setSvgKey(k => k + 1), 80)
  }

  // ── Derived positional data for champion slot ──────────────────────────────
  const maxRound    = rounds.length > 0 ? rounds[rounds.length - 1] : 1
  const finalMatch  = layout.find(m => m.roundNumber === maxRound && m.indexInRound === 0)
  const champX      = (finalMatch?.x ?? 0) + CARD_W + COL_GAP
  const champY      = finalMatch?.centerY ?? 0

  // ── Intro screen ───────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(135deg, #080e1a 0%, #0d1e3a 50%, #080e1a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stars />
        <motion.div
          animate={{ scale: [1, 1.045, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            fontFamily: 'var(--font-jost)',
            fontSize: 'clamp(3rem, 10vw, 6rem)',
            fontWeight: 900,
            color: 'white',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          THE DRAW
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontFamily: 'var(--font-jost)',
            color: 'rgba(255,255,255,0.38)',
            fontSize: '1.1rem',
            marginTop: 10,
            letterSpacing: '0.32em',
          }}
        >
          IS ABOUT TO BEGIN
        </motion.div>
      </div>
    )
  }

  // ── Main bracket UI ────────────────────────────────────────────────────────
  const roundLabel = (count: number, round: number) =>
    count === 1 ? 'FINAL'
    : count === 2 ? 'SEMI-FINALS'
    : count <= 4 ? 'QTR-FINALS'
    : `ROUND ${round}`

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(155deg, #070d1a 0%, #0b1830 60%, #070d1a 100%)',
        position: 'relative',
      }}
    >
      <Stars />

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 24px',
          background: 'rgba(7,13,26,0.88)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16 }}>🎱</span>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-jost)',
                fontWeight: 700,
                color: 'white',
                fontSize: 14,
                lineHeight: 1.2,
              }}
            >
              {tournament.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-jost)',
                color: 'rgba(255,255,255,0.28)',
                fontSize: 11,
              }}
            >
              {new Date(tournament.eventDate + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AnimatePresence>
            {champion && (
              <motion.div
                key="champ-badge"
                initial={{ opacity: 0, scale: 0.75, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  background: 'linear-gradient(135deg, #E8CC00, #E8820A)',
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontFamily: 'var(--font-jost)',
                  fontWeight: 800,
                  color: 'white',
                  fontSize: 12,
                  letterSpacing: '0.02em',
                }}
              >
                🏆 {champion.name}
              </motion.div>
            )}
          </AnimatePresence>

          <Link
            href={`/host/pool/knockout/${tournament.id}`}
            style={{
              fontFamily: 'var(--font-jost)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.22)',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            ← Setup
          </Link>
        </div>
      </div>

      {/* ── Bracket scroll container ────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', padding: '52px 48px 72px' }}>
        <div style={{ position: 'relative', width: totalW, height: totalH, minHeight: SLOT_H }}>

          {/* Round column labels */}
          {rounds.map(round => {
            const count = layout.filter(m => m.roundNumber === round).length
            const x     = (round - 1) * ROUND_W
            return (
              <div
                key={round}
                style={{
                  position: 'absolute',
                  left: x,
                  top: -34,
                  width: CARD_W,
                  textAlign: 'center',
                  fontFamily: 'var(--font-jost)',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.18)',
                  letterSpacing: '0.22em',
                }}
              >
                {roundLabel(count, round)}
              </div>
            )
          })}

          {/* Champion label */}
          {finalMatch && (
            <div
              style={{
                position: 'absolute',
                left: champX,
                top: -34,
                width: CARD_W,
                textAlign: 'center',
                fontFamily: 'var(--font-jost)',
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(232,204,0,0.28)',
                letterSpacing: '0.22em',
              }}
            >
              CHAMPION
            </div>
          )}

          {/* ── SVG connector lines ─────────────────────────────────────────── */}
          <svg
            key={svgKey}
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
            width={totalW + 120}
            height={totalH + 60}
          >
            {linesVisible &&
              lines.map(line => (
                <motion.path
                  key={line.key}
                  d={line.d}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: { duration: 0.55, delay: line.delay, ease: 'easeOut' },
                    opacity: { duration: 0.2, delay: line.delay },
                  }}
                />
              ))}
          </svg>

          {/* ── Match cards ─────────────────────────────────────────────────── */}
          {layout.map(match => (
            <BracketMatchCard
              key={match.id}
              match={match}
              visible={isVisible(match)}
              initialAnim={showReveal || match.roundNumber > 1}
              onSelectWinner={handleSelectWinner}
            />
          ))}

          {/* ── Champion card ────────────────────────────────────────────────── */}
          <AnimatePresence>
            {champion && finalMatch && (
              <motion.div
                key="champion-card"
                initial={{ opacity: 0, scale: 0.82, x: 16 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
                style={{
                  position: 'absolute',
                  left: champX,
                  top: champY - CARD_H / 2 - 22,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-jost)',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#E8CC00',
                    letterSpacing: '0.24em',
                    marginBottom: 6,
                  }}
                >
                  🏆 CHAMPION
                </div>
                <div
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #E8CC00 0%, #E8820A 100%)',
                    boxShadow: '0 0 48px rgba(232,204,0,0.32), 0 0 12px rgba(232,130,10,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 14px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-jost)',
                      fontSize: 14,
                      fontWeight: 900,
                      color: 'white',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {champion.name}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── "Tap to pick winner" hint ────────────────────────────────────────── */}
      {phase === 'bracket' && !champion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-jost)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.18)',
            textAlign: 'center',
            letterSpacing: '0.05em',
            pointerEvents: 'none',
          }}
        >
          Tap a player name to record the winner
        </motion.div>
      )}

      {/* ── "DRAWING…" pulse during reveal ───────────────────────────────────── */}
      {phase === 'revealing' && revealedCount < r1Count && (
        <motion.div
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-jost)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.25em',
            pointerEvents: 'none',
          }}
        >
          DRAWING…
        </motion.div>
      )}
    </div>
  )
}
