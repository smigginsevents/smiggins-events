import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types'

async function getLatestPoolLeaderboard(): Promise<LeaderboardEntry[]> {
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

export default async function HomePage() {
  const poolLeaderboard = await getLatestPoolLeaderboard()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
        <span className="font-display text-2xl tracking-wide">SMIGGINS</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/trivia" className="hover:text-mustard transition-colors">Trivia</Link>
          <Link href="/pool" className="hover:text-mustard transition-colors">Pool Comp</Link>
          <Link href="/host/login" className="text-white/40 hover:text-white/70 transition-colors text-xs">
            Host
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-navy text-white py-20 px-6 text-center">
        <p className="text-timber text-sm tracking-widest uppercase mb-3">Smiggins Hotel · Charlotte Pass</p>
        <h1 className="font-display text-6xl md:text-8xl tracking-wide leading-none mb-4">
          WEEKLY<br />EVENTS
        </h1>
        <p className="text-white/60 max-w-md mx-auto text-base">
          Two events, every week — all season long.
        </p>
      </section>

      {/* Events */}
      <section className="bg-snow flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">

          {/* Trivia Card */}
          <Link
            href="/trivia"
            className="bg-snow-card rounded-2xl border border-timber/20 shadow-sm p-8 hover:shadow-md hover:border-timber/40 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="font-display text-5xl text-rust tracking-wide group-hover:scale-105 transition-transform inline-block">
                TRIVIA
              </span>
              <span className="bg-rust/10 text-rust text-xs font-semibold px-2.5 py-1 rounded-full">
                Tuesday
              </span>
            </div>
            <h2 className="text-xl font-semibold text-navy mb-2">4 Pines Trivia Night</h2>
            <p className="text-navy/60 text-sm leading-relaxed">
              Teams of up to six. Multiple rounds. Big-screen show. Prizes for the night&apos;s winner and the all-time leaderboard leaders.
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-rust text-sm font-medium">
              See leaderboard
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Pool Comp Card */}
          <div className="bg-snow-card rounded-2xl border border-timber/20 shadow-sm p-8">
            <div className="flex items-start justify-between mb-4">
              <span className="font-display text-5xl text-navy tracking-wide">POOL</span>
              <span className="bg-navy/10 text-navy text-xs font-semibold px-2.5 py-1 rounded-full">
                Monday
              </span>
            </div>
            <h2 className="text-xl font-semibold text-navy mb-2">Monday Night Pool Comp</h2>
            <p className="text-navy/60 text-sm leading-relaxed mb-6">
              Weekly pool competition. Turn up, put your name down, play for points. All skill levels welcome.
            </p>

            {/* Mini leaderboard preview */}
            {poolLeaderboard.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-timber uppercase tracking-wider mb-3">This week</p>
                <ul className="flex flex-col gap-2">
                  {poolLeaderboard.slice(0, 3).map((entry) => (
                    <li key={entry.team_id} className="flex items-center justify-between text-sm">
                      <span className="text-navy font-medium">{entry.rank}. {entry.team_name}</span>
                      <span className="text-navy/50">{entry.total_points} pts</span>
                    </li>
                  ))}
                </ul>
                <Link href="/pool" className="mt-4 inline-flex items-center gap-1 text-navy text-sm font-medium hover:text-rust transition-colors">
                  Full leaderboard →
                </Link>
              </div>
            ) : (
              <Link href="/pool" className="text-navy text-sm font-medium hover:text-rust transition-colors">
                View leaderboard →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-pine text-white/60 py-8 px-6 text-center text-sm">
        <p>Smiggins Hotel · Charlotte Pass, NSW</p>
        <p className="mt-1 text-white/30 text-xs">
          Questions? Ask at the bar.
        </p>
      </footer>
    </div>
  )
}
