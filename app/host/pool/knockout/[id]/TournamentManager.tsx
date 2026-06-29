'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

// ─── DB helpers ───────────────────────────────────────────────────────────────

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

async function dbGenerateDraw(
  tournamentId: string,
  playerEntries: Array<{ id: string; name: string }>,
) {
  const supabase = createClient()
  const players = [...playerEntries]
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]]
  }
  const matchRows: any[] = []
  for (let i = 0; i < players.length; i += 2) {
    const matchNum = Math.floor(i / 2) + 1
    const isBye = i + 1 >= players.length
    matchRows.push({
      tournament_id: tournamentId,
      round_number: 1,
      match_number: matchNum,
      table_number: ((matchNum - 1) % 2) + 1,
      player1_id: players[i].id,
      player2_id: isBye ? null : players[i + 1].id,
      is_bye: isBye,
      status: isBye ? 'complete' : 'pending',
      winner_id: isBye ? players[i].id : null,
    })
  }
  const { error } = await supabase.from('pool_matches').insert(matchRows)
  if (error) throw new Error(error.message)
  for (let i = 0; i < players.length; i++) {
    await supabase.from('pool_tournament_entries')
      .update({ draw_order: i + 1 })
      .eq('tournament_id', tournamentId)
      .eq('player_id', players[i].id)
  }
  await supabase.from('pool_tournaments').update({ status: 'active' }).eq('id', tournamentId)
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player     { id: string; name: string }
interface Entry      { playerId: string; name: string }
interface Tournament { id: string; name: string; eventDate: string; status: string }
interface Props {
  tournament: Tournament
  entries:    Entry[]
  allPlayers: Player[]
}

// ─── Pool ball (matches leaderboard StaticBall, scaled for TV) ───────────────
function PoolBall({ hue, size = 72 }: { hue: 'orange' | 'yellow'; size?: number }) {
  const base  = hue === 'orange' ? '#E8820A' : '#E8CC00'
  const light = hue === 'orange' ? '#FFCA6A' : '#FFF08A'
  const dark  = hue === 'orange' ? '#7A3800' : '#967E00'
  const num   = hue === 'orange' ? '5' : '1'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
      background: `radial-gradient(circle at 33% 28%, ${light} 0%, ${base} 52%, ${dark} 100%)`,
      boxShadow: `inset -4px -5px 14px rgba(0,0,0,0.45), inset 3px 3px 8px rgba(255,255,255,0.22), 0 8px 28px rgba(0,0,0,0.55)`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: size * 0.48, height: size * 0.48, borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-jost)', fontWeight: 900, fontSize: size * 0.26, color: '#1a1a1a', lineHeight: 1 }}>
            {num}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Full-screen background ───────────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Pool-Comp-webBG.jpg" alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(155deg, rgba(6,14,42,0.78) 0%, rgba(3,8,26,0.72) 100%)',
      }} />
    </div>
  )
}

// ─── Player entry row ─────────────────────────────────────────────────────────
function PlayerRow({ entry, index, onRemove }: { entry: Entry; index: number; onRemove: () => void }) {
  const [hovering, setHovering] = useState(false)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.15s',
        background: hovering ? 'rgba(255,255,255,0.04)' : 'transparent',
        cursor: 'default',
      }}
    >
      {/* Number */}
      <div style={{
        fontFamily: 'var(--font-jost)', fontWeight: 900,
        fontSize: '1.6rem', lineHeight: 1,
        color: 'rgba(255,255,255,0.12)',
        minWidth: 36, textAlign: 'right',
        letterSpacing: '-0.02em',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Name */}
      <div style={{
        flex: 1,
        fontFamily: 'var(--font-jost)', fontWeight: 600,
        fontSize: '1.2rem', lineHeight: 1.2,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: '0.01em',
        textShadow: '0 1px 8px rgba(0,0,0,0.4)',
      }}>
        {entry.name}
      </div>

      {/* Remove */}
      <motion.button
        onClick={onRemove}
        animate={{ opacity: hovering ? 0.7 : 0.18 }}
        whileHover={{ opacity: 1, scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,80,80,0.9)', fontSize: '1rem',
          padding: '4px 8px', borderRadius: 6, lineHeight: 1,
        }}
      >
        ✕
      </motion.button>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TournamentManager({ tournament, entries, allPlayers }: Props) {
  const router = useRouter()
  const [search, setSearch]           = useState('')
  const [localEntries, setLocalEntries] = useState(entries)
  const [drawLoading, setDrawLoading] = useState(false)
  const [adding, setAdding]           = useState(false)
  const inputRef                      = useRef<HTMLInputElement>(null)

  const status = tournament.status

  // Auto-redirect active/complete tournaments straight to bracket
  useEffect(() => {
    if (status === 'active' || status === 'complete') {
      router.replace(`/host/pool/knockout/${tournament.id}/bracket`)
    }
  }, [status, tournament.id, router])

  const enteredIds  = new Set(localEntries.map(e => e.playerId))
  const suggestions = allPlayers.filter(
    p => !enteredIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()),
  )

  // Day + time from eventDate
  const dayLabel = new Date(tournament.eventDate + 'T00:00:00')
    .toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase()

  async function addPlayer(playerName: string) {
    const trimmed = playerName.trim()
    if (!trimmed || adding) return
    setSearch('')
    setAdding(true)
    try {
      const player = await dbGetOrCreatePlayer(trimmed)
      if (!enteredIds.has(player.id)) {
        await dbAddEntry(tournament.id, player)
        setLocalEntries(prev => [...prev, { playerId: player.id, name: player.name }])
      }
    } catch (e: any) {
      alert('Could not add player: ' + e.message)
    } finally {
      setAdding(false)
      inputRef.current?.focus()
    }
  }

  async function removePlayer(playerId: string) {
    setLocalEntries(prev => prev.filter(e => e.playerId !== playerId))
    try { await dbRemoveEntry(tournament.id, playerId) } catch { /* ignore */ }
  }

  async function handleGenerateDraw() {
    setDrawLoading(true)
    try {
      const playerList = localEntries
        .filter(e => !e.playerId.startsWith('pending-'))
        .map(e => ({ id: e.playerId, name: e.name }))
      await dbGenerateDraw(tournament.id, playerList)
      router.push(`/host/pool/knockout/${tournament.id}/bracket?reveal=1`)
    } catch (e: any) {
      alert('Draw failed: ' + e.message)
      setDrawLoading(false)
    }
  }

  const canGenerate = localEntries.length >= 2 && !drawLoading

  // If redirecting (active/complete), show minimal overlay
  if (status !== 'setup') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(4,10,28,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Background />
        <div style={{
          position: 'relative', zIndex: 10,
          fontFamily: 'var(--font-jost)', fontSize: '1rem',
          color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em',
        }}>
          OPENING BRACKET…
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      overflow: 'hidden', display: 'flex',
      fontFamily: 'var(--font-jost)',
    }}>
      <Background />

      {/* ── LEFT PANEL — Branding (dominant, wider half) ───────────────────── */}
      <div style={{
        width: '57%', position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 72px',
        gap: 0,
      }}>
        {/* ── POOL COMP logo block — tight, cohesive, big ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}
        >
          {/* Smiggins logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/smigginslogo-white.png" alt="Smiggins"
            style={{ height: 'clamp(72px, 8vw, 104px)', objectFit: 'contain', opacity: 0.9, marginBottom: 'clamp(18px, 2.6vw, 32px)' }}
          />

          {/* P [🟠5] [🟡1] L  →  "POOL" with balls as the OO */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.8vw, 11px)' }}
          >
            {/* P */}
            <span style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(6rem, 10vw, 11.5rem)',
              color: 'white', lineHeight: 1, letterSpacing: '-0.02em',
              textShadow: '0 6px 48px rgba(0,0,0,0.6)',
            }}>P</span>

            {/* 5-ball (orange) */}
            <PoolBall hue="orange" size={116} />

            {/* 1-ball (yellow) */}
            <PoolBall hue="yellow" size={116} />

            {/* L */}
            <span style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(6rem, 10vw, 11.5rem)',
              color: 'white', lineHeight: 1, letterSpacing: '-0.02em',
              textShadow: '0 6px 48px rgba(0,0,0,0.6)',
            }}>L</span>
          </motion.div>

          {/* COMP — tight against POOL row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(3.2rem, 5.6vw, 6.4rem)',
              color: 'white', letterSpacing: '0.32em',
              lineHeight: 1, marginTop: 0,
              textShadow: '0 4px 28px rgba(0,0,0,0.5)',
            }}
          >
            COMP
          </motion.div>
        </motion.div>

        {/* ── Hosted by — separated generously from the logo block ─────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.85, delay: 0.48 }}
          style={{
            fontFamily: 'var(--font-dancing)',
            fontSize: 'clamp(1.8rem, 2.6vw, 2.8rem)',
            color: 'rgba(255,255,255,0.88)',
            textShadow: '0 2px 20px rgba(0,0,0,0.35)',
            lineHeight: 1.2,
            marginTop: 'clamp(40px, 5.5vw, 68px)',
          }}
        >
          Hosted by Freddy Holler
        </motion.div>

        {/* Day + time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.62 }}
          style={{
            fontFamily: 'var(--font-jost)',
            fontSize: '1rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.32)',
            letterSpacing: '0.32em', marginTop: 12,
          }}
        >
          {dayLabel} · 8:30PM
        </motion.div>

        {/* Subtle bottom divider line on left */}
        <div style={{
          position: 'absolute', bottom: 0, left: '10%', right: '10%',
          height: 1,
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)',
        }} />
      </div>

      {/* ── Centre divider ─────────────────────────────────────────────────── */}
      <div style={{
        width: 1, alignSelf: 'stretch', margin: '72px 0',
        background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.14) 25%, rgba(255,255,255,0.14) 75%, transparent 100%)',
        position: 'relative', zIndex: 10, flexShrink: 0,
      }} />

      {/* ── RIGHT PANEL — Player registration (narrower) ───────────────────── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        padding: '68px 44px 56px',
        gap: 0,
        minWidth: 0,
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 28,
          }}
        >
          <div style={{
            fontWeight: 900, fontSize: '1.6rem',
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            Tonight&apos;s Players
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={localEntries.length}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
              style={{
                background: localEntries.length >= 2 ? 'rgba(21,103,165,0.5)' : 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.8rem', fontWeight: 700,
                borderRadius: 20, padding: '3px 12px',
                letterSpacing: '0.08em',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {localEntries.length} {localEntries.length === 1 ? 'PLAYER' : 'PLAYERS'}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Player list — scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(4,10,30,0.52)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          marginBottom: 24,
          minHeight: 120,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent',
        }}>
          <AnimatePresence initial={false}>
            {localEntries.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: 160, gap: 10,
                  color: 'rgba(255,255,255,0.22)',
                }}
              >
                <div style={{ fontSize: '2rem', opacity: 0.5 }}>🎱</div>
                <div style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>
                  ADD PLAYERS TO GET STARTED
                </div>
              </motion.div>
            ) : (
              localEntries.map((entry, idx) => (
                <PlayerRow
                  key={entry.playerId}
                  entry={entry}
                  index={idx}
                  onRemove={() => removePlayer(entry.playerId)}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Add player form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ position: 'relative', marginBottom: 20 }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter player name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search.trim() && addPlayer(search)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 10,
                  padding: '14px 20px',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: '1.05rem',
                  fontFamily: 'var(--font-jost)',
                  fontWeight: 500,
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: '0.01em',
                  backdropFilter: 'blur(8px)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(96,165,250,0.6)'
                  e.target.style.background = 'rgba(255,255,255,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.16)'
                  e.target.style.background = 'rgba(255,255,255,0.07)'
                }}
              />

              {/* Autocomplete dropdown */}
              <AnimatePresence>
                {search.trim() && (suggestions.length > 0 || search.trim()) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scaleY: 0.92 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: 4, scaleY: 0.92 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', bottom: '110%', left: 0, right: 0,
                      background: 'rgba(6,14,42,0.97)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      zIndex: 20,
                      boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    {suggestions.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        onClick={() => addPlayer(p.name)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 20px',
                          fontFamily: 'var(--font-jost)', fontSize: '1rem',
                          color: 'rgba(255,255,255,0.8)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span>{p.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                          RETURNING
                        </span>
                      </button>
                    ))}
                    {search.trim() && !suggestions.some(p => p.name.toLowerCase() === search.toLowerCase()) && (
                      <button
                        onClick={() => addPlayer(search)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 20px',
                          fontFamily: 'var(--font-jost)', fontSize: '1rem',
                          color: 'rgba(96,165,250,0.9)',
                          display: 'flex', gap: 8, alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: '1.2rem' }}>+</span>
                        <span>Add &ldquo;{search.trim()}&rdquo; as new player</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ADD button */}
            <motion.button
              onClick={() => addPlayer(search)}
              disabled={!search.trim() || adding}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'rgba(21,103,165,0.7)',
                border: '1px solid rgba(96,165,250,0.25)',
                borderRadius: 10,
                padding: '0 28px',
                fontFamily: 'var(--font-jost)', fontWeight: 700,
                fontSize: '0.9rem', letterSpacing: '0.12em',
                color: 'white', cursor: 'pointer',
                opacity: !search.trim() || adding ? 0.4 : 1,
                transition: 'opacity 0.2s',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
              }}
            >
              {adding ? '…' : 'ADD'}
            </motion.button>
          </div>
        </motion.div>

        {/* GENERATE DRAW button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          {localEntries.length < 2 && (
            <p style={{
              textAlign: 'center', marginBottom: 12,
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.14em',
            }}>
              ADD AT LEAST 2 PLAYERS TO GENERATE THE DRAW
            </p>
          )}

          <motion.button
            onClick={handleGenerateDraw}
            disabled={!canGenerate}
            animate={canGenerate ? {
              boxShadow: [
                '0 8px 40px rgba(21,103,165,0.30)',
                '0 8px 52px rgba(21,103,165,0.55)',
                '0 8px 40px rgba(21,103,165,0.30)',
              ],
            } : {}}
            transition={canGenerate ? { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } : {}}
            whileHover={canGenerate ? { scale: 1.02, y: -1 } : {}}
            whileTap={canGenerate ? { scale: 0.98 } : {}}
            style={{
              width: '100%',
              padding: '20px 0',
              borderRadius: 14,
              border: 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              opacity: canGenerate ? 1 : 0.3,
              background: canGenerate
                ? 'linear-gradient(135deg, rgba(21,80,165,0.9) 0%, rgba(8,28,88,0.95) 100%)'
                : 'rgba(20,30,60,0.6)',
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: '1.4rem', letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'white',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}
          >
            {drawLoading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  style={{ display: 'inline-block', fontSize: '1.3rem' }}
                >
                  ⟳
                </motion.span>
                <span>GENERATING DRAW…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.3rem' }}>🎱</span>
                <span>GENERATE DRAW</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </div>

      {/* ── Subtle back link ───────────────────────────────────────────────── */}
      <a
        href="/host/pool/knockout"
        style={{
          position: 'fixed', top: 18, left: 20, zIndex: 40,
          fontFamily: 'var(--font-jost)', fontSize: 11,
          color: 'rgba(255,255,255,0.18)', textDecoration: 'none',
          letterSpacing: '0.06em', padding: '5px 10px',
          borderRadius: 6, background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(8px)',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
        onMouseLeave={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.18)')}
      >
        ← Tournaments
      </a>
    </div>
  )
}
