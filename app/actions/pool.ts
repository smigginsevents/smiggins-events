'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Tournaments
// ─────────────────────────────────────────────────────────────────────────────

export async function createTournament(name: string, eventDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pool_tournaments')
    .insert({ name, event_date: eventDate, status: 'setup' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function completeTournament(tournamentId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pool_tournaments')
    .update({ status: 'complete' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
  revalidatePath('/pool')
  revalidatePath('/host/pool/knockout')
}

// ─────────────────────────────────────────────────────────────────────────────
// Players & Entries
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreatePlayer(name: string): Promise<string> {
  const supabase = await createClient()
  const trimmed = name.trim()

  // Try to find existing player (case-insensitive)
  const { data: existing } = await supabase
    .from('pool_players')
    .select('id')
    .ilike('name', trimmed)
    .single()

  if (existing) return existing.id

  // Create new player
  const { data, error } = await supabase
    .from('pool_players')
    .insert({ name: trimmed })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function addPlayerToTournament(tournamentId: string, playerName: string) {
  const playerId = await getOrCreatePlayer(playerName)
  const supabase = await createClient()

  const { error } = await supabase
    .from('pool_tournament_entries')
    .insert({ tournament_id: tournamentId, player_id: playerId })
    .select()

  if (error && !error.message.includes('unique')) throw new Error(error.message)
  revalidatePath(`/host/pool/knockout/${tournamentId}`)
}

export async function removePlayerFromTournament(tournamentId: string, playerId: string) {
  const supabase = await createClient()
  await supabase
    .from('pool_tournament_entries')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  revalidatePath(`/host/pool/knockout/${tournamentId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw Generation
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedMatch {
  round_number: number
  match_number: number
  table_number: number
  player1_id: string
  player1_name: string
  player2_id: string | null
  player2_name: string | null
  is_bye: boolean
}

export async function generateDraw(tournamentId: string): Promise<GeneratedMatch[]> {
  const supabase = await createClient()

  // Get entries with player names
  const { data: entries, error: eErr } = await supabase
    .from('pool_tournament_entries')
    .select('player_id, pool_players(name)')
    .eq('tournament_id', tournamentId)

  if (eErr) throw new Error(eErr.message)
  if (!entries || entries.length < 2) throw new Error('Need at least 2 players')

  // Shuffle players randomly (Fisher-Yates)
  const players = entries.map((e: any) => ({ id: e.player_id, name: e.pool_players.name }))
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]]
  }

  // Build round 1 match pairs
  const matchSpecs: Omit<GeneratedMatch, 'player1_name' | 'player2_name'>[] = []
  let matchNum = 0

  for (let i = 0; i < players.length; i += 2) {
    matchNum++
    const tableNum = ((matchNum - 1) % 2) + 1
    const isBye = i + 1 >= players.length

    matchSpecs.push({
      round_number: 1,
      match_number: matchNum,
      table_number: tableNum,
      player1_id: players[i].id,
      player2_id: isBye ? null : players[i + 1].id,
      is_bye: isBye,
    })
  }

  // Persist matches + update draw_order + set tournament status active
  const insertRows = matchSpecs.map(m => ({
    tournament_id: tournamentId,
    round_number: m.round_number,
    match_number: m.match_number,
    table_number: m.table_number,
    player1_id: m.player1_id,
    player2_id: m.player2_id,
    is_bye: m.is_bye,
    status: m.is_bye ? 'complete' : 'pending',
    winner_id: m.is_bye ? m.player1_id : null,
  }))

  const { error: insErr } = await supabase.from('pool_matches').insert(insertRows)
  if (insErr) throw new Error(insErr.message)

  // Store draw_order on entries
  for (let i = 0; i < players.length; i++) {
    await supabase
      .from('pool_tournament_entries')
      .update({ draw_order: i + 1 })
      .eq('tournament_id', tournamentId)
      .eq('player_id', players[i].id)
  }

  // Mark tournament active
  await supabase
    .from('pool_tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)

  revalidatePath(`/host/pool/knockout/${tournamentId}`)
  revalidatePath('/pool')

  // Return full match list with names for the animation
  const playerMap = new Map(players.map(p => [p.id, p.name]))
  return matchSpecs.map(m => ({
    ...m,
    player1_name: playerMap.get(m.player1_id) ?? '',
    player2_name: m.player2_id ? (playerMap.get(m.player2_id) ?? '') : null,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Match Management
// ─────────────────────────────────────────────────────────────────────────────

export async function recordWinner(matchId: string, winnerId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pool_matches')
    .update({ winner_id: winnerId, status: 'complete' })
    .eq('id', matchId)
  if (error) throw new Error(error.message)
}

export async function generateNextRound(tournamentId: string): Promise<GeneratedMatch[]> {
  const supabase = await createClient()

  // Get all matches to find max match_number and current round winners
  const { data: allMatches, error } = await supabase
    .from('pool_matches')
    .select('round_number, match_number, winner_id, is_bye, status, pool_players!pool_matches_winner_id_fkey(name)')
    .eq('tournament_id', tournamentId)
    .order('match_number', { ascending: true })

  if (error) throw new Error(error.message)

  const maxRound = Math.max(...allMatches.map((m: any) => m.round_number))
  const currentRoundMatches = allMatches.filter((m: any) => m.round_number === maxRound)

  // Verify all are complete
  if (currentRoundMatches.some((m: any) => m.status !== 'complete')) {
    throw new Error('Not all matches in current round are complete')
  }

  const winners = currentRoundMatches.map((m: any) => ({
    id: m.winner_id,
    name: (m.pool_players as any)?.name ?? '',
  }))

  if (winners.length === 1) {
    // Tournament over — complete it
    await completeTournament(tournamentId)
    return []
  }

  const maxMatchNum = Math.max(...allMatches.map((m: any) => m.match_number))
  const nextRound = maxRound + 1
  const matchSpecs: Omit<GeneratedMatch, 'player1_name' | 'player2_name'>[] = []
  let matchNum = maxMatchNum

  for (let i = 0; i < winners.length; i += 2) {
    matchNum++
    const tableNum = ((matchSpecs.length) % 2) + 1
    const isBye = i + 1 >= winners.length

    matchSpecs.push({
      round_number: nextRound,
      match_number: matchNum,
      table_number: tableNum,
      player1_id: winners[i].id,
      player2_id: isBye ? null : winners[i + 1].id,
      is_bye: isBye,
    })
  }

  const insertRows = matchSpecs.map(m => ({
    tournament_id: tournamentId,
    round_number: m.round_number,
    match_number: m.match_number,
    table_number: m.table_number,
    player1_id: m.player1_id,
    player2_id: m.player2_id,
    is_bye: m.is_bye,
    status: m.is_bye ? 'complete' : 'pending',
    winner_id: m.is_bye ? m.player1_id : null,
  }))

  await supabase.from('pool_matches').insert(insertRows)
  revalidatePath(`/host/pool/knockout/${tournamentId}`)

  const winnerMap = new Map(winners.map(w => [w.id, w.name]))
  return matchSpecs.map(m => ({
    ...m,
    player1_name: winnerMap.get(m.player1_id) ?? '',
    player2_name: m.player2_id ? (winnerMap.get(m.player2_id) ?? '') : null,
  }))
}
