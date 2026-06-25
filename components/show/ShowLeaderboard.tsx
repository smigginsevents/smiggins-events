'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { LeaderboardEntry } from '@/lib/types'

const PODIUM_STYLES = [
  { bar: 'bg-mustard', text: 'text-mustard', label: '1st' },
  { bar: 'bg-white/60', text: 'text-white/80', label: '2nd' },
  { bar: 'bg-timber/80', text: 'text-timber', label: '3rd' },
]

interface Props {
  entries: LeaderboardEntry[]
  heading?: string
}

export function ShowLeaderboard({ entries, heading = 'Leaderboard' }: Props) {
  const maxPts = Math.max(...entries.map((e) => e.total_points), 1)

  return (
    <div className="w-full max-w-3xl mx-auto px-6">
      <h2 className="font-display text-5xl text-white text-center tracking-wide mb-10">
        {heading}
      </h2>

      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {entries.map((entry, i) => {
            const style = PODIUM_STYLES[i] ?? { bar: 'bg-white/20', text: 'text-white/60', label: `${i + 1}th` }
            const pct = Math.max((entry.total_points / maxPts) * 100, 4)

            return (
              <motion.div
                key={entry.team_id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex items-center gap-4"
              >
                <span className={`font-display text-2xl w-10 text-right shrink-0 ${style.text}`}>
                  {entry.rank}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-white text-lg font-semibold">{entry.team_name}</span>
                    <span className={`text-sm font-bold ${style.text}`}>{entry.total_points} pts</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${style.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
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
