import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentManager } from './TournamentManager'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: tournament },
    { data: entries },
    { data: allPlayers },
  ] = await Promise.all([
    supabase.from('pool_tournaments').select('*').eq('id', id).single(),
    supabase
      .from('pool_tournament_entries')
      .select('player_id, draw_order, pool_players(id, name)')
      .eq('tournament_id', id)
      .order('draw_order', { ascending: true, nullsFirst: false }),
    supabase.from('pool_players').select('id, name').order('name'),
  ])

  if (!tournament) notFound()

  const entryList = (entries ?? []).map((e: any) => ({
    playerId: e.player_id,
    name: e.pool_players?.name ?? '',
  }))

  return (
    <TournamentManager
      tournament={{ id: tournament.id, name: tournament.name, eventDate: tournament.event_date, status: tournament.status }}
      entries={entryList}
      allPlayers={(allPlayers ?? []).map((p: any) => ({ id: p.id, name: p.name }))}
    />
  )
}
