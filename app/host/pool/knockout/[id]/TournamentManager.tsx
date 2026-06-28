'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers (browser client — avoids server-action serialisation issues)
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

async function dbGenerateDraw(
  tournamentId: string,
  playerEntries: Array<{ id: string; name: string }>,
) {
  const supabase = createClient()

  // Fisher-Yates shuffle
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Player     { id: string; name: string }
interface Entry      { playerId: string; name: string }
interface Tournament { id: string; name: string; eventDate: string; status: string }

interface Props {
  tournament: Tournament
  entries: Entry[]
  allPlayers: Player[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function TournamentManager({ tournament, entries, allPlayers }: Props) {
  const router = useRouter()
  const [search, setSearch]           = useState('')
  const [localEntries, setLocalEntries] = useState(entries)
  const [drawLoading, setDrawLoading] = useState(false)
  const [status]                      = useState(tournament.status)

  const enteredIds = new Set(localEntries.map(e => e.playerId))
  const suggestions = allPlayers.filter(
    p => !enteredIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()),
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
    } catch { /* ignore */ }
  }

  async function handleGenerateDraw() {
    setDrawLoading(true)
    try {
      const playerList = localEntries
        .filter(e => !e.playerId.startsWith('pending-'))
        .map(e => ({ id: e.playerId, name: e.name }))
      await dbGenerateDraw(tournament.id, playerList)
      // Navigate to the full-screen bracket with the draw reveal animation
      router.push(`/host/pool/knockout/${tournament.id}/bracket?reveal=1`)
    } catch (e: any) {
      alert('Draw failed: ' + e.message)
      setDrawLoading(false)
    }
  }

  const date = new Date(tournament.eventDate).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/host/pool/knockout" className="text-timber text-sm hover:text-navy block mb-1">
            ← Tournaments
          </Link>
          <h1 className="text-2xl font-semibold text-navy">{tournament.name}</h1>
          <p className="text-navy/50 text-sm">{date}</p>
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1 ${
            status === 'active'   ? 'bg-green-100 text-green-700'
            : status === 'complete' ? 'bg-navy/10 text-navy/60'
            : 'bg-amber-100 text-amber-700'
          }`}
        >
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
                    <button
                      onClick={() => removePlayer(entry.playerId)}
                      className="text-navy/25 hover:text-rust text-xs px-2 py-1 rounded transition-colors"
                    >
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
                    <button
                      onClick={() => addPlayer(p.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-snow transition-colors flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-navy/30 text-xs">existing player</span>
                    </button>
                  </li>
                ))}
                {search.trim() && !suggestions.some(p => p.name.toLowerCase() === search.toLowerCase()) && (
                  <li>
                    <button
                      onClick={() => addPlayer(search)}
                      className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-snow transition-colors flex items-center gap-2"
                    >
                      <span className="text-smiggins-blue font-semibold">+ Create &ldquo;{search.trim()}&rdquo;</span>
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

      {/* ── ACTIVE / COMPLETE — open bracket ── */}
      {(status === 'active' || status === 'complete') && (
        <div className="flex flex-col items-center gap-5 py-6">
          {status === 'complete' && (
            <div className="rounded-2xl p-5 text-center bg-navy/5 border border-navy/10 w-full max-w-sm">
              <div className="text-2xl mb-2">🏆</div>
              <div
                className="text-navy font-black text-lg"
                style={{ fontFamily: 'var(--font-jost)' }}
              >
                Tournament Complete
              </div>
            </div>
          )}

          <Link
            href={`/host/pool/knockout/${tournament.id}/bracket`}
            className="inline-flex items-center gap-3 rounded-2xl px-10 py-4 font-black text-white text-xl transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0d1e3a 0%, #1567A5 100%)',
              boxShadow: '0 8px 32px rgba(21,103,165,0.35)',
              fontFamily: 'var(--font-jost)',
              letterSpacing: '0.04em',
              textDecoration: 'none',
            }}
          >
            <span>🎱</span>
            <span>OPEN BRACKET</span>
          </Link>
          <p className="text-navy/35 text-xs text-center">
            Manage the full tournament on the bracket screen
          </p>
        </div>
      )}
    </div>
  )
}
