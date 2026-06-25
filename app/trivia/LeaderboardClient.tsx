'use client'

import { useState } from 'react'
import type { LeaderboardEntry } from '@/lib/types'
import { LeaderboardBars } from '@/components/leaderboard/LeaderboardBars'

type Tab = 'tonight' | 'alltime'

interface Props {
  tonight: LeaderboardEntry[]
  allTime: LeaderboardEntry[]
}

export function TriviaLeaderboardClient({ tonight, allTime }: Props) {
  const [tab, setTab] = useState<Tab>('tonight')
  const entries = tab === 'tonight' ? tonight : allTime

  return (
    <div className="mt-8">
      {/* Tab toggle */}
      <div className="inline-flex rounded-lg border border-timber/30 p-1 mb-8 bg-snow-card">
        {(['tonight', 'alltime'] as Tab[]).map((t) => (
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
            {t === 'tonight' ? "Tonight" : "All-Time"}
          </button>
        ))}
      </div>

      <LeaderboardBars entries={entries} />
    </div>
  )
}
