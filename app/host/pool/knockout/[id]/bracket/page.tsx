import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BracketView } from './BracketView'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ reveal?: string }>
}

export default async function BracketPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { reveal } = await searchParams
  const supabase = await createClient()

  const [{ data: tournament }, { data: matches }] = await Promise.all([
    supabase.from('pool_tournaments').select('*').eq('id', id).single(),
    supabase
      .from('pool_matches')
      .select(`
        id, round_number, match_number, table_number, is_bye, status, winner_id,
        player1:pool_players!pool_matches_player1_id_fkey(id, name),
        player2:pool_players!pool_matches_player2_id_fkey(id, name),
        winner:pool_players!pool_matches_winner_id_fkey(id, name)
      `)
      .eq('tournament_id', id)
      .order('match_number', { ascending: true }),
  ])

  if (!tournament) notFound()

  const matchList = (matches ?? []).map((m: any) => ({
    id: m.id,
    roundNumber: m.round_number,
    matchNumber: m.match_number,
    tableNumber: m.table_number,
    isBye: m.is_bye,
    status: m.status,
    player1: m.player1 ? { id: m.player1.id, name: m.player1.name } : null,
    player2: m.player2 ? { id: m.player2.id, name: m.player2.name } : null,
    winner: m.winner  ? { id: m.winner.id,  name: m.winner.name }  : null,
  }))

  return (
    <BracketView
      tournament={{
        id: tournament.id,
        name: tournament.name,
        eventDate: tournament.event_date,
        status: tournament.status,
      }}
      initialMatches={matchList}
      showReveal={reveal === '1'}
    />
  )
}
