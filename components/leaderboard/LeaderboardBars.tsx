'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { LeaderboardEntry } from '@/lib/types'

interface LeaderboardBarsProps {
  entries: LeaderboardEntry[]
  /** Show animated entry — set false for static rendering */
  animate?: boolean
}

const RANK_COLORS = ['bg-mustard', 'bg-timber/60', 'bg-timber/40']
const RANK_LABEL_COLORS = ['text-mustard', 'text-timber/80', 'text-timber/60']

export function LeaderboardBars({ entries, animate = true }: LeaderboardBarsProps) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-navy/40 py-10 text-sm">No scores yet.</p>
    )
  }

  const maxPoints = Math.max(...entries.map((e) => e.total_points), 1)

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence>
        {entries.map((entry, i) => {
          const pct = Math.max((entry.total_points / maxPoints) * 100, 4)
          const barColor = RANK_COLORS[i] ?? 'bg-navy/20'
          const labelColor = RANK_LABEL_COLORS[i] ?? 'text-navy/40'

          return (
            <motion.div
              key={entry.team_id}
              layout={animate}
              initial={animate ? { opacity: 0, x: -20 } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex items-center gap-3"
            >
              {/* Rank */}
              <span className={`w-6 text-right text-sm font-semibold shrink-0 ${labelColor}`}>
                {entry.rank}
              </span>

              {/* Bar + label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-navy truncate">{entry.team_name}</span>
                  <span className="text-xs text-navy/50 shrink-0">{entry.total_points} pts</span>
                </div>
                <div className="h-2 rounded-full bg-navy/8 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    initial={animate ? { width: 0 } : { width: `${pct}%` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
