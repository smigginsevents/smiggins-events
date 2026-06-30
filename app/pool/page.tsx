import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data fetching
// ─────────────────────────────────────────────────────────────────────────────
async function getLeaderboard() {
  const supabase = await createClient()

  const [
    { data: players },
    { data: matches },
    { data: tournaments },
  ] = await Promise.all([
    supabase.from('pool_players').select('id, name'),
    supabase.from('pool_matches').select('player1_id, player2_id, winner_id, tournament_id, round_number, status, is_bye, is_silver_match'),
    supabase.from('pool_tournaments').select('id, status, silver_winner_id'),
  ])

  if (!players) return []

  const completedIds = new Set(
    (tournaments ?? []).filter(t => t.status === 'complete').map(t => t.id)
  )

  // Gold: winner of the grand final (exclude silver playoff matches from round calc)
  const winnerByTournament = new Map<string, string>()
  const silverByTournament = new Map<string, string>()
  for (const t of tournaments ?? []) {
    if (t.status !== 'complete') continue
    if (t.silver_winner_id) silverByTournament.set(t.id, t.silver_winner_id)
  }
  for (const tid of completedIds) {
    const tMatches = (matches ?? []).filter(
      m => m.tournament_id === tid && m.status === 'complete' && !m.is_bye && !m.is_silver_match,
    )
    if (!tMatches.length) continue
    const maxRound = Math.max(...tMatches.map(m => m.round_number))
    const finals = tMatches.filter(m => m.round_number === maxRound)
    if (finals.length === 1 && finals[0].winner_id) {
      winnerByTournament.set(tid, finals[0].winner_id)
    }
  }

  const stats = players.map(player => {
    const played = (matches ?? []).filter(
      m => !m.is_bye && m.status === 'complete' && (m.player1_id === player.id || m.player2_id === player.id)
    )
    const gamesWon  = played.filter(m => m.winner_id === player.id).length
    const gamesLost = played.filter(m => m.winner_id !== player.id).length
    const compWins  = [...winnerByTournament.values()].filter(w => w === player.id).length
    const silverFinishes = [...silverByTournament.values()].filter(w => w === player.id).length

    return { id: player.id, name: player.name, compWins, silverFinishes, gamesWon, gamesLost }
  })

  return stats
    .filter(s => s.gamesWon + s.gamesLost > 0 || s.compWins > 0 || s.silverFinishes > 0)
    .sort((a, b) => {
      if (b.compWins  !== a.compWins)  return b.compWins  - a.compWins
      if (b.gamesWon  !== a.gamesWon)  return b.gamesWon  - a.gamesWon
      return a.gamesLost - b.gamesLost
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool ball letters (static, no animation)
// ─────────────────────────────────────────────────────────────────────────────
const BS = 48

function StaticBall({ hue }: { hue: 'orange' | 'yellow' }) {
  const base  = hue === 'orange' ? '#E8820A' : '#E8CC00'
  const light = hue === 'orange' ? '#FFCA6A' : '#FFF08A'
  const dark  = hue === 'orange' ? '#7A3800' : '#967E00'
  const num   = hue === 'orange' ? '5' : '1'

  return (
    <div style={{
      width: BS, height: BS, borderRadius: '50%', flexShrink: 0, position: 'relative',
      background: `radial-gradient(circle at 33% 28%, ${light} 0%, ${base} 52%, ${dark} 100%)`,
      boxShadow: `inset -3px -4px 10px rgba(0,0,0,0.4), inset 3px 3px 6px rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: BS * 0.48, height: BS * 0.48, borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: BS * 0.26, fontWeight: 900, color: '#1a1a1a', fontFamily: 'var(--font-jost)', lineHeight: 1 }}>{num}</span>
        </div>
      </div>
    </div>
  )
}

function PoolLogo() {
  const letterSx: React.CSSProperties = {
    fontFamily: 'var(--font-jost)',
    fontWeight: 900,
    color: 'white',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    fontSize: '2.8rem',
  }

  return (
    <div className="flex flex-col items-center">
      <Image src="/smigginslogo-white.png" alt="Smiggins" width={100} height={50} className="object-contain mb-2" />
      <div className="flex items-center" style={{ gap: 3 }}>
        <span style={letterSx}>P</span>
        <StaticBall hue="orange" />
        <StaticBall hue="yellow" />
        <span style={letterSx}>L</span>
      </div>
      <div style={{ ...letterSx, fontSize: '1.6rem', letterSpacing: '0.25em', marginTop: 2 }}>COMP</div>
      <p style={{ fontFamily: 'var(--font-jost)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: 6, letterSpacing: '0.08em' }}>
        Season Leaderboard
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function PoolLeaderboardPage() {
  const rows = await getLeaderboard()

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background photo */}
      <div className="fixed inset-0 -z-10">
        <Image src="/Pool-Comp-webBG.jpg" alt="" fill className="object-cover object-center" priority />
        {/* Deep blue overlay — keep it light enough to see the photo */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(12,28,58,0.52) 0%, rgba(8,18,44,0.62) 100%)' }} />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-10 max-w-4xl mx-auto w-full">

        {/* Header */}
        <div className="mb-8 text-center">
          <PoolLogo />
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="text-white/40 text-center py-16" style={{ fontFamily: 'var(--font-jost)' }}>
            <p className="text-xl mb-2">No results yet</p>
            <p className="text-sm">Check back after Monday night!</p>
          </div>
        ) : (
          <div className="w-full rounded-2xl overflow-hidden" style={{ background: 'rgba(4,10,30,0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Column headers */}
            <div className="grid px-5 py-3" style={{
              gridTemplateColumns: '56px 1fr 110px 90px 90px',
              background: 'rgba(0,0,0,0.28)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {['Rank', 'Player', 'Comp Wins', 'Won', 'Lost'].map(h => (
                <div key={h} className="text-center first:text-left" style={{
                  fontFamily: 'var(--font-jost)', fontSize: '0.7rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase',
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
                  className="grid items-center px-5 py-4"
                  style={{
                    gridTemplateColumns: '56px 1fr 110px 90px 90px',
                    background: rowBg,
                    borderBottom: idx < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  {/* Rank */}
                  <div className="flex items-center">
                    <span style={{
                      fontFamily: 'var(--font-jost)',
                      fontSize: isTop3 ? '2rem' : '1.4rem',
                      fontWeight: 900,
                      color: isTop3 ? 'white' : 'rgba(255,255,255,0.5)',
                      lineHeight: 1,
                    }}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Player name */}
                  <div style={{
                    fontFamily: 'var(--font-jost)',
                    fontSize: '0.95rem',
                    fontWeight: isTop3 ? 700 : 500,
                    color: 'white',
                    textTransform: 'uppercase',
                  }}>
                    {row.name}
                    {row.compWins > 0 && (
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#E8CC00' }}>
                        {'★'.repeat(Math.min(row.compWins, 5))}
                      </span>
                    )}
                    {row.silverFinishes > 0 && (
                      <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'rgba(192,192,192,0.9)' }}>
                        {'🥈'.repeat(Math.min(row.silverFinishes, 5))}
                      </span>
                    )}
                  </div>

                  {/* Comp Wins */}
                  <div className="text-center" style={{
                    fontFamily: 'var(--font-jost)', fontSize: '1rem',
                    fontWeight: 700, color: row.compWins > 0 ? '#E8CC00' : 'rgba(255,255,255,0.5)',
                  }}>
                    {row.compWins}
                  </div>

                  {/* Games Won */}
                  <div className="text-center" style={{
                    fontFamily: 'var(--font-jost)', fontSize: '1rem',
                    fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                  }}>
                    {row.gamesWon}
                  </div>

                  {/* Games Lost */}
                  <div className="text-center" style={{
                    fontFamily: 'var(--font-jost)', fontSize: '1rem',
                    fontWeight: 400, color: 'rgba(255,255,255,0.45)',
                  }}>
                    {row.gamesLost}
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
