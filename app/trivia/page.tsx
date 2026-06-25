import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types'
import { TriviaLeaderboardClient } from './LeaderboardClient'

async function getTonightLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('trivia_events')
    .select('id')
    .in('status', ['live', 'complete'])
    .order('event_date', { ascending: false })
    .limit(1)

  if (!events || events.length === 0) return []

  const eventId = events[0].id

  const { data: scores } = await supabase
    .from('trivia_scores')
    .select('team_id, points, teams(name)')
    .eq('event_id', eventId)

  if (!scores) return []

  const totals = scores.reduce<Record<string, { name: string; pts: number }>>((acc, s: any) => {
    if (!acc[s.team_id]) acc[s.team_id] = { name: s.teams?.name ?? 'Unknown', pts: 0 }
    acc[s.team_id].pts += Number(s.points)
    return acc
  }, {})

  return Object.entries(totals)
    .sort(([, a], [, b]) => b.pts - a.pts)
    .map(([teamId, val], i) => ({
      team_id: teamId,
      team_name: val.name,
      total_points: val.pts,
      rank: i + 1,
    }))
}

async function getAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data: scores } = await supabase
    .from('trivia_scores')
    .select('team_id, points, trivia_events(status), teams(name)')

  if (!scores) return []

  const completed = scores.filter((s: any) => s.trivia_events?.status === 'complete')

  const totals = completed.reduce<Record<string, { name: string; pts: number }>>((acc, s: any) => {
    if (!acc[s.team_id]) acc[s.team_id] = { name: s.teams?.name ?? 'Unknown', pts: 0 }
    acc[s.team_id].pts += Number(s.points)
    return acc
  }, {})

  return Object.entries(totals)
    .sort(([, a], [, b]) => b.pts - a.pts)
    .map(([teamId, val], i) => ({
      team_id: teamId,
      team_name: val.name,
      total_points: val.pts,
      rank: i + 1,
    }))
}

export default async function TriviaPage() {
  const [tonight, allTime] = await Promise.all([
    getTonightLeaderboard(),
    getAllTimeLeaderboard(),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="bg-navy text-white px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">← Home</Link>
        <span className="font-display text-2xl tracking-wide">TRIVIA NIGHT</span>
      </header>

      <main className="flex-1 bg-snow py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-2">
            <h1 className="text-3xl font-semibold text-navy">4 Pines Trivia Night</h1>
            <p className="text-navy/50 text-sm mt-1">Every Tuesday · Smiggins Hotel</p>
          </div>

          <Suspense fallback={null}>
            <TriviaLeaderboardClient tonight={tonight} allTime={allTime} />
          </Suspense>
        </div>
      </main>

      <footer className="bg-pine text-white/50 py-6 px-6 text-center text-xs">
        Smiggins Hotel · Charlotte Pass, NSW
      </footer>
    </div>
  )
}
