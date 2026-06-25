'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useAnimation } from 'framer-motion'
import { useEffect } from 'react'

// ── Letter-scatter for "EVENTS" ────────────────────────────────────────────────
const LETTERS = ['E', 'V', 'E', 'N', 'T', 'S']
const LETTER_ORIGINS = [
  { x: -300, y: -200, rotate: -60 },
  { x:  200, y: -300, rotate:  45 },
  { x: -150, y:  250, rotate: -40 },
  { x:  350, y:  150, rotate:  70 },
  { x: -400, y:  100, rotate: -55 },
  { x:  250, y: -200, rotate:  35 },
]

// ── Pool Ball ─────────────────────────────────────────────────────────────────
function PoolBall({ color, number, size = 74 }: { color: string; number: number; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 32%, ${color === '#F5A623' ? '#FFD580' : '#FFE87A'} 0%, ${color} 55%, ${color === '#F5A623' ? '#B8670A' : '#B89800'} 100%)`,
        boxShadow: `inset -5px -5px 14px rgba(0,0,0,0.35), inset 5px 5px 10px rgba(255,255,255,0.28), 0 6px 20px rgba(0,0,0,0.5)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Gloss highlight */}
      <div style={{
        position: 'absolute',
        top: '14%',
        left: '20%',
        width: '30%',
        height: '20%',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.35)',
        transform: 'rotate(-20deg)',
        pointerEvents: 'none',
      }} />
      {/* White circle with number */}
      <div style={{
        width: size * 0.46,
        height: size * 0.46,
        borderRadius: '50%',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.23,
          fontWeight: 900,
          color: '#222',
          fontFamily: 'var(--font-jost)',
          lineHeight: 1,
        }}>
          {number}
        </span>
      </div>
    </div>
  )
}

// ── Pool Word Animation (POOL with ball O's) ───────────────────────────────────
function PoolWordAnimation() {
  const orangeCtrl = useAnimation()  // first O — orange #5, rolls in from distance
  const yellowCtrl = useAnimation()  // second O — yellow #1, already waiting
  const pCtrl      = useAnimation()
  const lCtrl      = useAnimation()
  const mondayCtrl = useAnimation()
  const compCtrl   = useAnimation()
  const footerCtrl = useAnimation()

  useEffect(() => {
    async function run() {
      await new Promise(r => setTimeout(r, 320))

      // Orange rolls in from the distance (small → full, left-to-right into O1 slot)
      await orangeCtrl.start({
        scale: 1,
        x: 0,
        opacity: 1,
        rotate: 480,
        transition: { duration: 0.85, ease: [0.22, 0.61, 0.36, 1] },
      })

      // IMPACT — both balls surge toward viewer
      await Promise.all([
        orangeCtrl.start({ scale: 1.18, transition: { duration: 0.11 } }),
        yellowCtrl.start({ scale: 1.18, transition: { duration: 0.11 } }),
      ])
      await Promise.all([
        orangeCtrl.start({ scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }),
        yellowCtrl.start({ scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }),
      ])

      // P and L fly in
      await Promise.all([
        pCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } }),
        lCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } }),
      ])

      // MONDAY slides down
      await mondayCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } })

      await new Promise(r => setTimeout(r, 100))

      // COMP slides up
      await compCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } })

      await new Promise(r => setTimeout(r, 200))

      footerCtrl.start({ opacity: 1, transition: { duration: 0.4 } })
    }
    run()
  }, [orangeCtrl, yellowCtrl, pCtrl, lCtrl, mondayCtrl, compCtrl, footerCtrl])

  const letterStyle: React.CSSProperties = {
    fontFamily: 'var(--font-jost)',
    fontSize: 'clamp(3.8rem, 9vw, 5.5rem)',
    fontWeight: 900,
    color: 'white',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  }

  return (
    <div className="flex flex-col items-center gap-0 w-full px-6">
      {/* MONDAY */}
      <motion.div
        animate={mondayCtrl}
        initial={{ opacity: 0, y: -18 }}
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 'clamp(0.75rem, 2.2vw, 0.95rem)',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.38em',
        }}
      >
        MONDAY
      </motion.div>

      {/* P [○] [○] L */}
      <div className="flex items-center" style={{ gap: 4 }}>
        <motion.span
          animate={pCtrl}
          initial={{ opacity: 0, x: -36 }}
          style={letterStyle}
        >
          P
        </motion.span>

        {/* Orange ball — first O, rolls in from distance */}
        <motion.div
          animate={orangeCtrl}
          initial={{ scale: 0.12, x: 50, opacity: 0.7, rotate: 0 }}
          style={{ transformOrigin: 'center center' }}
        >
          <PoolBall color="#F5A623" number={5} />
        </motion.div>

        {/* Yellow ball — second O, already in position */}
        <motion.div animate={yellowCtrl} initial={{ scale: 1 }}>
          <PoolBall color="#F5D800" number={1} />
        </motion.div>

        <motion.span
          animate={lCtrl}
          initial={{ opacity: 0, x: 36 }}
          style={letterStyle}
        >
          L
        </motion.span>
      </div>

      {/* COMP */}
      <motion.div
        animate={compCtrl}
        initial={{ opacity: 0, y: 18 }}
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 'clamp(2rem, 5.5vw, 3.2rem)',
          fontWeight: 900,
          color: 'white',
          letterSpacing: '0.18em',
          lineHeight: 1,
        }}
      >
        COMP
      </motion.div>

      {/* Footer */}
      <motion.div
        animate={footerCtrl}
        initial={{ opacity: 0 }}
        className="text-center mt-6"
      >
        <div className="h-px bg-white/10 mb-4 w-32 mx-auto" />
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>
          Starts 9pm
        </p>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          in the Smiggins Hotel bar
        </p>
        <Link href="/pool" style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 10, display: 'inline-block' }} className="hover:text-white/70 transition-colors">
          Leaderboard →
        </Link>
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
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-3"
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

        {/* EVENTS letters fly in */}
        <div className="flex items-center gap-0.5 md:gap-1 overflow-visible">
          {LETTERS.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: LETTER_ORIGINS[i].x, y: LETTER_ORIGINS[i].y, rotate: LETTER_ORIGINS[i].rotate }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.72, delay: 0.5 + i * 0.07, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-white select-none"
              style={{
                fontFamily: 'var(--font-jost)',
                fontSize: 'clamp(3.8rem, 13vw, 9.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Hosted by Freddy Holler — Great Vibes */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.3 }}
          className="text-white/70 mt-1 mb-8"
          style={{
            fontFamily: 'var(--font-dancing)',
            fontSize: 'clamp(1.25rem, 3.5vw, 1.8rem)',
            letterSpacing: '0.01em',
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
            className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center py-10"
            style={{
              background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <PoolWordAnimation />
          </motion.div>

          {/* ── RIGHT: Trivia Tuesday ── */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.9, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {/* Question mark with 4 Pines logo overlaid */}
            <div className="relative flex justify-center pt-6 px-8" style={{ minHeight: 260 }}>
              {/* Question mark — large, fills the area */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 2.1 }}
                className="relative"
              >
                <Image
                  src="/questionmark.png"
                  alt=""
                  width={185}
                  height={296}
                  className="object-contain"
                  style={{ opacity: 0.92 }}
                />

                {/* 4 Pines logo — sits at the base of the question mark curve */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 2.35, ease: [0.22, 0.61, 0.36, 1] }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: '55%' }}
                >
                  <Image
                    src="/4Pines_Logo_Colour_circle.png"
                    alt="4 Pines Brewing"
                    width={86}
                    height={86}
                    className="object-contain drop-shadow-xl"
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* TRIVIA TUESDAY */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 2.3 }}
              className="px-5 pt-3 pb-2 text-center"
              style={{ lineHeight: 0.88 }}
            >
              <div
                className="text-white font-black uppercase"
                style={{
                  fontFamily: 'var(--font-jost)',
                  fontSize: 'clamp(3rem, 8.5vw, 5.5rem)',
                  letterSpacing: '-0.02em',
                }}
              >
                TRIVIA
              </div>
              <div
                className="text-white font-black uppercase"
                style={{
                  fontFamily: 'var(--font-jost)',
                  fontSize: 'clamp(3rem, 8.5vw, 5.5rem)',
                  letterSpacing: '-0.02em',
                }}
              >
                TUESDAY
              </div>
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.7, duration: 0.4 }}
              className="mt-auto px-6 pb-6 text-center"
            >
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
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* ── Minimal footer ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.9, duration: 0.6 }}
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
