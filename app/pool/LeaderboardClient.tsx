'use client'

import { useState } from 'react'
import type { LeaderboardEntry } from '@/lib/types'
import { LeaderboardBars } from '@/components/leaderboard/LeaderboardBars'

type Tab = 'thisweek' | 'alltime'

interface Props {
  thisWeek: LeaderboardEntry[]
  allTime: LeaderboardEntry[]
}

export function PoolLeaderboardClient({ thisWeek, allTime }: Props) {
  const [tab, setTab] = useState<Tab>('thisweek')
  const entries = tab === 'thisweek' ? thisWeek : allTime

  return (
    <div className="mt-8">
      <div className="inline-flex rounded-lg border border-timber/30 p-1 mb-8 bg-snow-card">
        {(['thisweek', 'alltime'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? 'bg-navy text-white shadow-sm'
                : 'text-navy/60 hover:text-navy',
            ].join(' ')}
          >
            {t === 'thisweek' ? 'This Week' : 'All-Time'}
          </button>
        ))}
      </div>

      <LeaderboardBars entries={entries} />
    </div>
  )
}
