import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types'
import { PoolLeaderboardClient } from './LeaderboardClient'

async function getThisWeekLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('pool_events')
    .select('id')
    .in('status', ['live', 'complete'])
    .order('event_date', { ascending: false })
    .limit(1)

  if (!events || events.length === 0) return []

  const eventId = events[0].id
  const { data: scores } = await supabase
    .from('pool_scores')
    .select('team_id, points, teams(name)')
    .eq('event_id', eventId)
    .order('points', { ascending: false })

  if (!scores) return []

  return scores.map((s: any, i) => ({
    team_id: s.team_id,
    team_name: s.teams?.name ?? 'Unknown',
    total_points: s.points,
    rank: i + 1,
  }))
}

async function getAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data: scores } = await supabase
    .from('pool_scores')
    .select('team_id, points, pool_events(status), teams(name)')

  if (!scores) return []

  const completed = scores.filter((s: any) => s.pool_events?.status === 'complete')

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

export default async function PoolPage() {
  const [thisWeek, allTime] = await Promise.all([
    getThisWeekLeaderboard(),
    getAllTimeLeaderboard(),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">← Home</Link>
        <span className="font-display text-2xl tracking-wide">POOL COMP</span>
      </header>

      <main className="flex-1 bg-snow py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-2">
            <h1 className="text-3xl font-semibold text-navy">Monday Night Pool Comp</h1>
            <p className="text-navy/50 text-sm mt-1">Every Monday · Smiggins Hotel</p>
          </div>

          <Suspense fallback={null}>
            <PoolLeaderboardClient thisWeek={thisWeek} allTime={allTime} />
          </Suspense>
        </div>
      </main>

      <footer className="bg-pine text-white/50 py-6 px-6 text-center text-xs">
        Smiggins Hotel · Charlotte Pass, NSW
      </footer>
    </div>
  )
}
