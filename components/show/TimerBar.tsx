'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  timerStartedAt: string | null
  durationSeconds: number
  onZero?: () => void
}

export function TimerBar({ timerStartedAt, durationSeconds, onZero }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const onZeroRef = useRef(onZero)
  onZeroRef.current = onZero
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    if (!timerStartedAt) {
      setRemaining(durationSeconds)
      return
    }

    function tick() {
      const elapsed = (Date.now() - new Date(timerStartedAt!).getTime()) / 1000
      const rem = Math.max(durationSeconds - elapsed, 0)
      setRemaining(rem)

      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true
        onZeroRef.current?.()
      }
    }

    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [timerStartedAt, durationSeconds])

  const pct = (remaining / durationSeconds) * 100
  const isAmber = pct < 50 && pct >= 20
  const isRed = pct < 20

  const barColor = isRed
    ? 'bg-rust'
    : isAmber
    ? 'bg-mustard'
    : 'bg-pine'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl font-display text-white tracking-wide tabular-nums">
        {Math.ceil(remaining)}
      </div>
      <div className="w-full max-w-2xl h-4 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors duration-500 ${barColor}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </div>
  )
}
