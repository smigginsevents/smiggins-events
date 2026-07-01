import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

async function getSeasonLeaderboard() {
  const supabase = await createClient()

  const { data: scores } = await supabase
    .from('trivia_scores')
    .select('team_id, points, event_id, trivia_events(status), teams(name)')

  if (!scores) return []

  const completed = (scores as any[]).filter(s => s.trivia_events?.status === 'complete')

  // Sum points per team per event to find each night's winner
  const eventTotals = new Map<string, Map<string, number>>()
  for (const s of completed) {
    if (!eventTotals.has(s.event_id)) eventTotals.set(s.event_id, new Map())
    const et = eventTotals.get(s.event_id)!
    et.set(s.team_id, (et.get(s.team_id) ?? 0) + Number(s.points))
  }

  const nightWins = new Map<string, number>()
  for (const [, teams] of eventTotals) {
    let maxPts = -1, winnerId = ''
    for (const [teamId, pts] of teams) {
      if (pts > maxPts) { maxPts = pts; winnerId = teamId }
    }
    if (winnerId) nightWins.set(winnerId, (nightWins.get(winnerId) ?? 0) + 1)
  }

  const teamTotals = new Map<string, { name: string; pts: number }>()
  for (const s of completed) {
    const id = s.team_id
    if (!teamTotals.has(id)) teamTotals.set(id, { name: s.teams?.name ?? 'Unknown', pts: 0 })
    teamTotals.get(id)!.pts += Number(s.points)
  }

  return [...teamTotals.entries()]
    .map(([id, val]) => ({
      id,
      name: val.name,
      nightWins: nightWins.get(id) ?? 0,
      totalPoints: val.pts,
    }))
    .filter(t => t.totalPoints > 0)
    .sort((a, b) => {
      if (b.nightWins !== a.nightWins) return b.nightWins - a.nightWins
      return b.totalPoints - a.totalPoints
    })
}

function TriviaLogo() {
  const letterSx: React.CSSProperties = {
    fontFamily: 'var(--font-jost)',
    fontWeight: 900,
    color: 'white',
    letterSpacing: '0.04em',
    lineHeight: 1,
  }

  return (
    <div className="flex flex-col items-center">
      <Image src="/smigginslogo-white.png" alt="Smiggins" width={100} height={50} className="object-contain mb-2" />
      <div style={{ ...letterSx, fontSize: '3rem' }}>TRIVIA</div>
      <div style={{ ...letterSx, fontSize: '1.8rem', letterSpacing: '0.22em', marginTop: 2 }}>TUESDAY</div>
      <p style={{ fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: 6, letterSpacing: '0.08em' }}>
        Season Leaderboard
      </p>
    </div>
  )
}

export default async function TriviaLeaderboardPage() {
  const rows = await getSeasonLeaderboard()

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background photo */}
      <div className="fixed inset-0 -z-10">
        <Image src="/Einstein-in-the-mountains.jpg" alt="" fill className="object-cover object-center" priority />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(12,28,58,0.52) 0%, rgba(8,18,44,0.62) 100%)' }} />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-10 max-w-4xl mx-auto w-full">

        {/* Header */}
        <div className="mb-8 text-center">
          <TriviaLogo />
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="text-white/40 text-center py-16" style={{ fontFamily: 'var(--font-jost)' }}>
            <p className="text-xl mb-2">No results yet</p>
            <p className="text-sm">Check back after Tuesday night!</p>
          </div>
        ) : (
          <div className="w-full rounded-2xl overflow-hidden" style={{ background: 'rgba(4,10,30,0.22)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Column headers */}
            <div className="grid lb-grid-trivia px-3 py-3 sm:px-5" style={{
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {['Rank', 'Team', 'Wins', 'Points'].map(h => (
                <div key={h} className="text-center first:text-left" style={{
                  fontFamily: 'var(--font-jost)', fontSize: '0.65rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{h}</div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map((row, idx) => {
              const isTop3 = idx < 3
              const rowBg = idx % 2 === 0
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.1)'

              return (
                <div
                  key={row.id}
                  className="grid lb-grid-trivia items-center px-3 py-3 sm:px-5 sm:py-4"
                  style={{
                    background: rowBg,
                    borderBottom: idx < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  {/* Rank */}
                  <div className="flex items-center">
                    <span style={{
                      fontFamily: 'var(--font-jost)',
                      fontSize: isTop3 ? 'clamp(1.3rem, 4vw, 2rem)' : 'clamp(1rem, 3vw, 1.4rem)',
                      fontWeight: 900,
                      color: isTop3 ? 'white' : 'rgba(255,255,255,0.5)',
                      lineHeight: 1,
                    }}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Team name */}
                  <div style={{
                    fontFamily: 'var(--font-jost)',
                    fontSize: 'clamp(0.7rem, 2.2vw, 0.95rem)',
                    fontWeight: isTop3 ? 700 : 500,
                    color: 'white',
                    textTransform: 'uppercase',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.name}
                    {row.nightWins > 0 && (
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#E8CC00' }}>
                        {'★'.repeat(Math.min(row.nightWins, 5))}
                      </span>
                    )}
                  </div>

                  {/* Night Wins */}
                  <div className="text-center" style={{
                    fontFamily: 'var(--font-jost)', fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
                    fontWeight: 700, color: row.nightWins > 0 ? '#E8CC00' : 'rgba(255,255,255,0.5)',
                  }}>
                    {row.nightWins}
                  </div>

                  {/* Total Points */}
                  <div className="text-center" style={{
                    fontFamily: 'var(--font-jost)', fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
                    fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                  }}>
                    {row.totalPoints}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Link href="/" className="mt-8 text-white/30 hover:text-white/60 text-xs transition-colors" style={{ fontFamily: 'var(--font-jost)' }}>
          ← Back to Events
        </Link>
      </div>
    </div>
  )
}
