'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useAnimation, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

// ── Letter-scatter animation for "EVENTS" ─────────────────────────────────────
const LETTERS = ['E', 'V', 'E', 'N', 'T', 'S']
const LETTER_ORIGINS = [
  { x: -300, y: -200, rotate: -60 },
  { x: 200,  y: -300, rotate:  45 },
  { x: -150, y:  250, rotate: -40 },
  { x:  350, y:  150, rotate:  70 },
  { x: -400, y:  100, rotate: -55 },
  { x:  250, y: -200, rotate:  35 },
]

// ── 8-Ball SVG ────────────────────────────────────────────────────────────────
function EightBall({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill="#111111" />
      <circle cx="50" cy="50" r="44" fill="#1a1a1a" />
      {/* Gloss highlight */}
      <ellipse cx="36" cy="34" rx="12" ry="8" fill="white" opacity="0.12" />
      {/* White circle with 8 */}
      <circle cx="50" cy="50" r="18" fill="white" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="20"
        fontWeight="900"
        fill="#111111"
        fontFamily="Arial, sans-serif"
      >
        8
      </text>
    </svg>
  )
}

// ── Pool Cue + Ball Animation ─────────────────────────────────────────────────
function PoolAnimation() {
  const cueControls = useAnimation()
  const ballControls = useAnimation()
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function run() {
      // Cue slides in from right
      await cueControls.start({
        x: 0,
        opacity: 1,
        transition: { duration: 0.9, ease: 'easeOut' },
      })
      // Brief pause
      await new Promise((r) => setTimeout(r, 200))
      // Cue thrusts forward (hits ball)
      await cueControls.start({
        x: -70,
        transition: { duration: 0.12, ease: 'easeIn' },
      })
      // Ball rolls toward viewer simultaneously
      ballControls.start({
        scale: 1,
        rotate: 540,
        y: 0,
        opacity: 1,
        transition: { duration: 0.85, ease: [0.22, 0.61, 0.36, 1] },
      })
      // Cue retracts
      await cueControls.start({
        x: 160,
        opacity: 0,
        transition: { duration: 0.5, ease: 'easeIn', delay: 0.1 },
      })
      setDone(true)
    }
    run()
  }, [cueControls, ballControls])

  return (
    <div className="relative flex items-center justify-center h-36 w-full overflow-hidden">
      {/* Pool table felt surface — subtle line */}
      <div className="absolute bottom-6 left-0 right-0 h-px bg-white/10" />

      {/* Pool Cue */}
      <motion.div
        animate={cueControls}
        initial={{ x: 160, opacity: 0 }}
        className="absolute"
        style={{ right: '20%', top: '40%' }}
      >
        <div
          className="relative"
          style={{
            width: 180,
            height: 10,
            transformOrigin: 'right center',
            transform: 'rotate(-18deg)',
          }}
        >
          {/* Cue shaft */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #2a1a0a 0%, #8B5E2A 30%, #C49A4A 60%, #E8C872 80%, #F5E0A0 100%)',
            }}
          />
          {/* Cue tip */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{ background: '#2563EB', marginLeft: -2 }}
          />
        </div>
      </motion.div>

      {/* 8-Ball */}
      <motion.div
        animate={ballControls}
        initial={{ scale: 0.25, rotate: 0, y: 12, opacity: 0.6 }}
        className="relative z-10 drop-shadow-2xl"
        style={{ filter: done ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' : undefined }}
      >
        <EightBall size={88} />
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#1567A5' }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center pt-12 pb-4 px-6">

        {/* Smiggins logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-4"
        >
          <Image
            src="/smigginslogo-white.png"
            alt="Smiggins Hotel"
            width={140}
            height={70}
            className="object-contain"
            priority
          />
        </motion.div>

        {/* EVENTS — letters fly in from different directions */}
        <div className="flex items-center gap-1 md:gap-2 overflow-visible">
          {LETTERS.map((letter, i) => (
            <motion.span
              key={i}
              initial={{
                opacity: 0,
                x: LETTER_ORIGINS[i].x,
                y: LETTER_ORIGINS[i].y,
                rotate: LETTER_ORIGINS[i].rotate,
              }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.5 + i * 0.07,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              className="text-white font-black leading-none select-none"
              style={{
                fontFamily: 'var(--font-jost)',
                fontSize: 'clamp(4rem, 14vw, 10rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Hosted by */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.3 }}
          className="text-white/70 mt-1 mb-8"
          style={{
            fontFamily: 'var(--font-cursive)',
            fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
          }}
        >
          Hosted by Freddy Holler
        </motion.p>
      </div>

      {/* ── Event Cards ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-5 pb-10 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-5">

          {/* ── LEFT: Monday Pool Comp ── */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex flex-col items-center justify-center pt-8 pb-2 px-6">
              {/* Stacked logo text */}
              <div className="text-center leading-none">
                <div
                  className="text-white/60 font-black tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(0.85rem, 2.5vw, 1.1rem)', letterSpacing: '0.35em' }}
                >
                  MONDAY
                </div>
                <div
                  className="text-white font-black uppercase leading-none"
                  style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3.5rem, 9vw, 5.5rem)', letterSpacing: '-0.02em' }}
                >
                  POOL
                </div>
                <div
                  className="text-white font-black uppercase leading-none"
                  style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(2.2rem, 6vw, 3.5rem)', letterSpacing: '0.15em' }}
                >
                  COMP
                </div>
              </div>

              {/* Pool animation */}
              <div className="w-full my-4">
                <PoolAnimation />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto px-6 pb-6 text-center">
              <div className="h-px bg-white/10 mb-4" />
              <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-jost)' }}>
                Starts 9pm
              </p>
              <p className="text-white/50 text-xs mt-0.5" style={{ fontFamily: 'var(--font-jost)' }}>
                in the Smiggins Hotel bar
              </p>
              <Link href="/pool" className="mt-3 inline-block text-white/40 hover:text-white/80 text-xs transition-colors" style={{ fontFamily: 'var(--font-jost)' }}>
                Leaderboard →
              </Link>
            </div>
          </motion.div>

          {/* ── RIGHT: Trivia Tuesday ── */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.9, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Question mark + 4 Pines logo */}
            <div className="relative flex items-center justify-center pt-6 pb-0 px-6" style={{ minHeight: 200 }}>
              {/* Big question mark */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 2.2 }}
                className="absolute"
                style={{ top: 16 }}
              >
                <Image
                  src="/questionmark.png"
                  alt=""
                  width={140}
                  height={224}
                  className="object-contain opacity-90"
                />
              </motion.div>

              {/* 4 Pines logo centred on question mark */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 2.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="relative z-10 mt-20"
              >
                <Image
                  src="/4Pines_Logo_Colour_circle.png"
                  alt="4 Pines Brewing"
                  width={80}
                  height={80}
                  className="object-contain drop-shadow-xl"
                />
              </motion.div>
            </div>

            {/* TRIVIA TUESDAY */}
            <div className="px-5 pt-3 pb-2 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 2.3 }}
                className="leading-none"
              >
                <div
                  className="text-white font-black uppercase"
                  style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3rem, 8.5vw, 5.5rem)', letterSpacing: '-0.02em', lineHeight: 0.9 }}
                >
                  TRIVIA
                </div>
                <div
                  className="text-white font-black uppercase"
                  style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3rem, 8.5vw, 5.5rem)', letterSpacing: '-0.02em', lineHeight: 0.95 }}
                >
                  TUESDAY
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="mt-auto px-6 pb-6 text-center">
              <div className="h-px bg-white/10 mb-4" />
              <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-jost)' }}>
                Starts 9pm
              </p>
              <p className="text-white/50 text-xs mt-0.5" style={{ fontFamily: 'var(--font-jost)' }}>
                in the Smiggins Hotel bar
              </p>
              <Link href="/trivia" className="mt-3 inline-block text-white/40 hover:text-white/80 text-xs transition-colors" style={{ fontFamily: 'var(--font-jost)' }}>
                Leaderboard →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Footer nav ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.8, duration: 0.6 }}
        className="pb-8 text-center"
      >
        <Link
          href="/host/login"
          className="text-white/20 hover:text-white/50 text-xs transition-colors"
          style={{ fontFamily: 'var(--font-jost)' }}
        >
          Host Login
        </Link>
      </motion.div>
    </div>
  )
}
