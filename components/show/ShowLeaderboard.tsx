'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { LeaderboardEntry } from '@/lib/types'

interface Props {
  entries: LeaderboardEntry[]
  heading?: string
}

const RANK_COLORS = ['#E0A53C', 'rgba(255,255,255,0.75)', '#9C7A52']
const RANK_BAR    = ['#E0A53C', 'rgba(255,255,255,0.55)', '#9C7A52']

export function ShowLeaderboard({ entries, heading = 'Leaderboard' }: Props) {
  const n = Math.max(entries.length, 1)
  const maxPts = Math.max(...entries.map(e => e.total_points), 1)

  // Distribute 80vh across rows (leaves 20vh for heading + padding)
  const rowVh   = Math.min(14, Math.floor(80 / n))
  // Font sizes shrink proportionally — clamped so they stay readable
  const rankVw  = Math.min(4,   Math.max(1.6, 32 / n))
  const nameVw  = Math.min(3.5, Math.max(1.2, 28 / n))
  const ptsVw   = Math.min(2.2, Math.max(0.9, 18 / n))
  const headVw  = Math.min(7,   Math.max(3,   56 / n))

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      padding: '3vh 8vw 2vh',
    }}>
      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: `clamp(1.8rem, ${headVw}vw, 8rem)`,
          color: 'white', textAlign: 'center',
          letterSpacing: '0.06em', lineHeight: 1,
          marginBottom: '2vh', flexShrink: 0,
        }}
      >
        {heading}
      </motion.h2>

      {/* Rows — flex-1 fills remaining space, justify-center keeps them centred */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence>
          {entries.map((entry, i) => {
            const pct = Math.max((entry.total_points / maxPts) * 100, 3)
            const rankColor = RANK_COLORS[i] ?? 'rgba(255,255,255,0.25)'
            const barColor  = RANK_BAR[i]   ?? 'rgba(255,255,255,0.18)'
            const isTop     = i < 3

            return (
              <motion.div
                key={entry.team_id}
                layout
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: '2vw',
                  height: `${rowVh}vh`,
                  borderBottom: i < entries.length - 1
                    ? '1px solid rgba(255,255,255,0.08)'
                    : 'none',
                  flexShrink: 0,
                }}
              >
                {/* Rank */}
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: `clamp(0.9rem, ${rankVw}vw, 5rem)`,
                  color: rankColor,
                  minWidth: '1.8em', textAlign: 'right',
                  flexShrink: 0, lineHeight: 1,
                }}>
                  {entry.rank}
                </span>

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: `${Math.max(0.3, rowVh * 0.06)}vh`,
                    gap: '1vw',
                  }}>
                    <span style={{
                      color: isTop ? 'white' : 'rgba(255,255,255,0.75)',
                      fontWeight: 700, textTransform: 'uppercase',
                      fontSize: `clamp(0.75rem, ${nameVw}vw, 4rem)`,
                      letterSpacing: '0.04em', lineHeight: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.team_name}
                    </span>
                    <span style={{
                      color: rankColor,
                      fontWeight: 700, flexShrink: 0,
                      fontSize: `clamp(0.65rem, ${ptsVw}vw, 2.5rem)`,
                    }}>
                      {entry.total_points} pts
                    </span>
                  </div>

                  {/* Bar */}
                  <div style={{
                    height: `max(3px, ${Math.max(0.25, rowVh * 0.05)}vh)`,
                    borderRadius: 9999,
                    background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: i * 0.07, ease: 'easeOut' }}
                      style={{ height: '100%', borderRadius: 9999, background: barColor }}
                    />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
