'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Team } from '@/lib/types'

// ─── Background ───────────────────────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Pool-Comp-webBG.jpg" alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
      {/* Trivia overlay — deeper, warmer tint to distinguish from Pool Comp */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(155deg, rgba(18,6,38,0.85) 0%, rgba(8,4,28,0.80) 100%)',
      }} />
    </div>
  )
}

// ─── Team row ─────────────────────────────────────────────────────────────────
function TeamRow({ team, index, onRemove }: { team: Team; index: number; onRemove: () => void }) {
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
        background: hovering ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
        cursor: 'default',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-jost)', fontWeight: 900,
        fontSize: '1.6rem', lineHeight: 1,
        color: 'rgba(255,255,255,0.12)',
        minWidth: 36, textAlign: 'right',
        letterSpacing: '-0.02em',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div style={{
        flex: 1,
        fontFamily: 'var(--font-jost)', fontWeight: 600,
        fontSize: '1.2rem', lineHeight: 1.2,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        textShadow: '0 1px 8px rgba(0,0,0,0.4)',
      }}>
        {team.name}
      </div>

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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TriviaTeamsPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [eventDate, setEventDate] = useState<string>('')
  const [teams, setTeams] = useState<Team[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const [{ data: evt }, { data: all }, { data: etRows }] = await Promise.all([
      supabase.from('trivia_events').select('event_date').eq('id', eventId).single(),
      supabase.from('teams').select('*').order('name'),
      supabase.from('trivia_event_teams')
        .select('team_id, teams(id,name,created_at)')
        .eq('event_id', eventId),
    ])
    if (evt) setEventDate(evt.event_date)
    setAllTeams(all ?? [])
    setTeams((etRows ?? []).map((r: any) => r.teams).filter(Boolean))
  }, [eventId])

  useEffect(() => { loadTeams() }, [loadTeams])

  const registeredIds = new Set(teams.map(t => t.id))
  const suggestions = allTeams.filter(
    t => !registeredIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function addTeam(name: string) {
    const trimmed = name.trim().toUpperCase()
    if (!trimmed || adding) return
    setSearch('')
    setAdding(true)
    try {
      const supabase = createClient()
      // Find existing team (case-insensitive)
      const existing = allTeams.find(t => t.name.toUpperCase() === trimmed)
      let team: Team
      if (existing) {
        team = existing
      } else {
        const { data, error } = await supabase
          .from('teams').insert({ name: trimmed }).select('*').single()
        if (error) throw new Error(error.message)
        team = data
      }
      if (!registeredIds.has(team.id)) {
        await supabase.from('trivia_event_teams').insert({ event_id: eventId, team_id: team.id })
        setTeams(prev => [...prev, team])
        setAllTeams(prev => prev.find(t => t.id === team.id) ? prev : [...prev, team])
      }
    } catch (e: any) {
      alert('Could not add team: ' + e.message)
    } finally {
      setAdding(false)
      inputRef.current?.focus()
    }
  }

  async function removeTeam(teamId: string) {
    setTeams(prev => prev.filter(t => t.id !== teamId))
    const supabase = createClient()
    await supabase.from('trivia_event_teams').delete().eq('event_id', eventId).eq('team_id', teamId)
  }

  const canStart = teams.length >= 2
  const dayLabel = eventDate
    ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase()
    : 'TUESDAY'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      overflow: 'hidden', display: 'flex',
      fontFamily: 'var(--font-jost)',
    }}>
      <Background />

      {/* ── LEFT PANEL — Branding ─────────────────────────────────────────── */}
      <div style={{
        width: '57%', position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 72px',
      }}>
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
            style={{ height: 'clamp(80px, 9vw, 116px)', objectFit: 'contain', opacity: 0.9, marginBottom: 'clamp(14px, 1.8vw, 24px)' }}
          />

          {/* TUESDAY */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(2.2rem, 4vw, 4.8rem)',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.38em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            TUESDAY
          </motion.div>

          {/* TRIVIA — the big hero word */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(7rem, 13vw, 15rem)',
              color: 'white',
              letterSpacing: '-0.02em',
              lineHeight: 0.9,
              textShadow: '0 6px 56px rgba(0,0,0,0.6)',
            }}
          >
            TRIVIA
          </motion.div>

          {/* NIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.38 }}
            style={{
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: 'clamp(3.8rem, 6.6vw, 7.8rem)',
              color: 'rgba(200,85,45,0.9)',
              letterSpacing: '0.32em',
              lineHeight: 1,
              marginTop: '-4px',
              textShadow: '0 4px 32px rgba(0,0,0,0.5)',
            }}
          >
            NIGHT
          </motion.div>
        </motion.div>

        {/* Hosted by */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.85, delay: 0.5 }}
          style={{
            fontFamily: 'var(--font-dancing)',
            fontSize: 'clamp(1.8rem, 2.6vw, 2.8rem)',
            color: 'rgba(255,255,255,0.88)',
            textShadow: '0 2px 20px rgba(0,0,0,0.35)',
            lineHeight: 1.2,
            marginTop: 'clamp(32px, 4.5vw, 56px)',
          }}
        >
          Hosted by Freddy Holler
        </motion.div>

        {/* Day + time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          style={{
            fontFamily: 'var(--font-jost)',
            fontSize: '1rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.32)',
            letterSpacing: '0.32em', marginTop: 12,
          }}
        >
          {dayLabel} · 8:30PM
        </motion.div>

        {/* Bottom line */}
        <div style={{
          position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1,
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)',
        }} />
      </div>

      {/* ── Centre divider ────────────────────────────────────────────────── */}
      <div style={{
        width: 1, alignSelf: 'stretch', margin: '72px 0', flexShrink: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.14) 25%, rgba(255,255,255,0.14) 75%, transparent 100%)',
        position: 'relative', zIndex: 10,
      }} />

      {/* ── RIGHT PANEL — Team registration ───────────────────────────────── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        padding: '68px 44px 56px',
        minWidth: 0,
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 28 }}
        >
          <div style={{
            fontWeight: 900, fontSize: '1.6rem',
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            Tonight&apos;s Teams
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={teams.length}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
              style={{
                background: teams.length >= 2 ? 'rgba(200,85,45,0.4)' : 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.8rem', fontWeight: 700,
                borderRadius: 20, padding: '3px 12px',
                letterSpacing: '0.08em',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Team list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(4,4,24,0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          marginBottom: 24,
          minHeight: 120,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent',
        }}>
          <AnimatePresence initial={false}>
            {teams.length === 0 ? (
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
                <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>?</div>
                <div style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>
                  ADD TEAMS TO GET STARTED
                </div>
              </motion.div>
            ) : (
              teams.map((team, idx) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  index={idx}
                  onRemove={() => removeTeam(team.id)}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Add team input */}
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
                placeholder="Enter team name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search.trim() && addTeam(search)}
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
                  e.target.style.borderColor = 'rgba(200,85,45,0.7)'
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
                      background: 'rgba(8,4,28,0.97)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      zIndex: 20,
                      boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    {suggestions.slice(0, 5).map(t => (
                      <button
                        key={t.id}
                        onClick={() => addTeam(t.name)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 20px',
                          fontFamily: 'var(--font-jost)', fontSize: '1rem',
                          color: 'rgba(255,255,255,0.8)',
                          textTransform: 'uppercase',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span>{t.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                          RETURNING
                        </span>
                      </button>
                    ))}
                    {search.trim() && !suggestions.some(t => t.name.toUpperCase() === search.trim().toUpperCase()) && (
                      <button
                        onClick={() => addTeam(search)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 20px',
                          fontFamily: 'var(--font-jost)', fontSize: '1rem',
                          color: 'rgba(200,85,45,0.9)',
                          display: 'flex', gap: 8, alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: '1.2rem' }}>+</span>
                        <span>Add &ldquo;{search.trim().toUpperCase()}&rdquo; as new team</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              onClick={() => addTeam(search)}
              disabled={!search.trim() || adding}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'rgba(200,85,45,0.55)',
                border: '1px solid rgba(200,85,45,0.3)',
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

        {/* LET THE GAMES BEGIN button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          {!canStart && (
            <p style={{
              textAlign: 'center', marginBottom: 12,
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.14em',
            }}>
              ADD AT LEAST 2 TEAMS TO CONTINUE
            </p>
          )}

          <motion.button
            onClick={() => router.push(`/host/trivia/${eventId}/run`)}
            disabled={!canStart}
            animate={canStart ? {
              boxShadow: [
                '0 8px 40px rgba(200,85,45,0.28)',
                '0 8px 52px rgba(200,85,45,0.52)',
                '0 8px 40px rgba(200,85,45,0.28)',
              ],
            } : {}}
            transition={canStart ? { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } : {}}
            whileHover={canStart ? { scale: 1.02, y: -1 } : {}}
            whileTap={canStart ? { scale: 0.98 } : {}}
            style={{
              width: '100%',
              padding: '20px 0',
              borderRadius: 14,
              border: 'none',
              cursor: canStart ? 'pointer' : 'not-allowed',
              opacity: canStart ? 1 : 0.3,
              background: canStart
                ? 'linear-gradient(135deg, rgba(160,55,25,0.92) 0%, rgba(80,18,8,0.96) 100%)'
                : 'rgba(30,10,20,0.6)',
              fontFamily: 'var(--font-jost)', fontWeight: 900,
              fontSize: '1.4rem', letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'white',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>🎯</span>
            <span>LET THE GAMES BEGIN!</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Back link */}
      <a
        href={`/host/trivia/${eventId}/questions`}
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
        ← Questions
      </a>
    </div>
  )
}
