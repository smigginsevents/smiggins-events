'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playCountdownBeep, playBuzzer } from '@/lib/sounds'

interface Props {
  timerStartedAt: string | null
  durationSeconds: number
  onZero?: () => void
}

const RADIUS = 88
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TimerBar({ timerStartedAt, durationSeconds, onZero }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const onZeroRef = useRef(onZero)
  onZeroRef.current = onZero
  const firedRef = useRef(false)
  const lastBeepRef = useRef(-1) // last whole-second at which a beep fired

  useEffect(() => {
    firedRef.current = false
    lastBeepRef.current = -1

    if (!timerStartedAt) {
      setRemaining(durationSeconds)
      return
    }

    function tick() {
      const elapsed = (Date.now() - new Date(timerStartedAt!).getTime()) / 1000
      const rem = Math.max(durationSeconds - elapsed, 0)
      setRemaining(rem)

      const secs = Math.ceil(rem)

      // Countdown beeps — fire once per whole second for last 10 seconds
      if (rem > 0 && secs <= 10 && secs !== lastBeepRef.current) {
        lastBeepRef.current = secs
        playCountdownBeep(secs)
      }

      // Buzzer + onZero at the end
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true
        playBuzzer()
        onZeroRef.current?.()
      }
    }

    tick()
    const id = setInterval(tick, 80)
    return () => clearInterval(id)
  }, [timerStartedAt, durationSeconds])

  const pct = remaining / durationSeconds
  const secs = Math.ceil(remaining)
  const offset = CIRCUMFERENCE * (1 - pct)

  const isAmber = pct < 0.5 && pct >= 0.2
  const isRed = pct < 0.2
  const isDone = remaining <= 0

  const ringColor = isDone ? '#ffffff' : isRed ? '#C8552D' : isAmber ? '#E0A53C' : '#4ade80'
  const textColor = isDone ? 'text-white' : isRed ? 'text-rust' : isAmber ? 'text-mustard' : 'text-green-400'

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Circular countdown ring */}
      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg
          width="200" height="200"
          className="absolute inset-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <motion.circle
            cx="100" cy="100" r={RADIUS}
            fill="none" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: offset, stroke: ringColor }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="popLayout">
            {isDone ? (
              <motion.span
                key="done"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-5xl text-white tracking-wide"
              >
                TIME!
              </motion.span>
            ) : (
              <motion.span
                key={secs}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{
                  scale: isRed && secs <= 5 ? [1, 1.08, 1] : 1,
                  opacity: 1,
                }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{
                  opacity: { duration: 0.12 },
                  scale: isRed && secs <= 5
                    ? { repeat: Infinity, duration: 0.6 }
                    : { duration: 0.15 },
                }}
                className={`font-display text-7xl tabular-nums leading-none ${textColor}`}
              >
                {secs}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="w-full max-w-lg">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${pct * 100}%`, backgroundColor: ringColor }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
        </div>
      </div>
    </div>
  )
}
