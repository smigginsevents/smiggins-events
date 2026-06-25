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

// ── Web Audio pool ball crack ─────────────────────────────────────────────────
function playBallCrack() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Noise burst — sharp transient
    const len = Math.floor(ctx.sampleRate * 0.07)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 110)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf

    // Bandpass — bright click range
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3800
    bp.Q.value = 1.8

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(1.4, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

    noise.connect(bp)
    bp.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + 0.07)

    // High tonal crack
    const osc1 = ctx.createOscillator()
    osc1.frequency.setValueAtTime(5200, now)
    osc1.frequency.exponentialRampToValueAtTime(900, now + 0.045)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.55, now)
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
    osc1.connect(g1); g1.connect(ctx.destination)
    osc1.start(now); osc1.stop(now + 0.045)

    // Low body thud
    const osc2 = ctx.createOscillator()
    osc2.frequency.setValueAtTime(900, now)
    osc2.frequency.exponentialRampToValueAtTime(180, now + 0.03)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.35, now)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.035)
    osc2.connect(g2); g2.connect(ctx.destination)
    osc2.start(now); osc2.stop(now + 0.035)

    setTimeout(() => ctx.close(), 400)
  } catch (_) {
    // silently skip if audio blocked
  }
}

// ── Pool Ball ─────────────────────────────────────────────────────────────────
const BALL_SIZE = 62

function PoolBall({ hue }: { hue: 'orange' | 'yellow' }) {
  const baseColor   = hue === 'orange' ? '#E8820A' : '#E8CC00'
  const lightColor  = hue === 'orange' ? '#FFCA6A' : '#FFF08A'
  const shadowColor = hue === 'orange' ? '#8B4200' : '#A08800'
  const textColor   = '#222'

  return (
    <div
      style={{
        width:  BALL_SIZE,
        height: BALL_SIZE,
        borderRadius: '50%',
        flexShrink: 0,
        position: 'relative',
        background: `radial-gradient(circle at 33% 28%, ${lightColor} 0%, ${baseColor} 52%, ${shadowColor} 100%)`,
        boxShadow: `inset -4px -5px 12px rgba(0,0,0,0.38), inset 4px 4px 8px rgba(255,255,255,0.25), 0 6px 18px rgba(0,0,0,0.55)`,
      }}
    >
      {/* Gloss */}
      <div style={{
        position: 'absolute', top: '12%', left: '18%',
        width: '32%', height: '22%',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.32)',
        transform: 'rotate(-20deg)',
        pointerEvents: 'none',
      }} />
      {/* Number circle */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: BALL_SIZE * 0.48, height: BALL_SIZE * 0.48,
          borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: BALL_SIZE * 0.24, fontWeight: 900,
            color: textColor, fontFamily: 'var(--font-jost)', lineHeight: 1,
          }}>
            {hue === 'orange' ? 5 : 1}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Pool Word Animation ────────────────────────────────────────────────────────
// Layout: P [Orange=O1] [Yellow=O2] L
// Yellow rolls in from left, stops at O1 slot.
// Orange rolls in from left, hits yellow → yellow pushed right to O2.
// P and L appear, then MONDAY / COMP / footer.
const GAP = 6          // px gap between flex items
const PUSH = BALL_SIZE + GAP   // how far yellow must shift right to reach O2 from O1

function PoolWordAnimation() {
  const yellowCtrl  = useAnimation()
  const orangeCtrl  = useAnimation()
  const pCtrl       = useAnimation()
  const lCtrl       = useAnimation()
  const mondayCtrl  = useAnimation()
  const compCtrl    = useAnimation()
  const footerCtrl  = useAnimation()

  useEffect(() => {
    async function run() {
      await new Promise(r => setTimeout(r, 280))

      // ── YELLOW rolls in from the left, stops at O1 position ──────────────
      // Yellow is the right ball (O2) in the final layout.
      // To sit at O1 temporarily, offset left by -(ballSize + gap).
      await yellowCtrl.start({
        x: -PUSH,   // sits exactly at O1 slot
        opacity: 1,
        rotate: -540,
        transition: { duration: 0.82, ease: [0.22, 0.61, 0.36, 1] },
      })

      await new Promise(r => setTimeout(r, 180))

      // ── ORANGE rolls in from the left, hits yellow ───────────────────────
      await orangeCtrl.start({
        x: 0,         // orange lands at O1 (its final position)
        opacity: 1,
        rotate: -600,
        transition: { duration: 0.78, ease: [0.22, 0.61, 0.36, 1] },
      })

      // IMPACT — sound + visual pop
      playBallCrack()
      orangeCtrl.start({ scale: [1, 1.14, 1], transition: { duration: 0.18 } })

      // Yellow pushed right to O2 (its own final position → x: 0)
      await yellowCtrl.start({
        x: 0,
        rotate: -420,
        transition: { duration: 0.22, ease: [0.33, 1, 0.68, 1] },
      })

      await new Promise(r => setTimeout(r, 80))

      // P and L appear
      await Promise.all([
        pCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } }),
        lCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } }),
      ])

      await mondayCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } })
      await new Promise(r => setTimeout(r, 80))
      await compCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } })
      await new Promise(r => setTimeout(r, 160))
      footerCtrl.start({ opacity: 1, transition: { duration: 0.4 } })
    }
    run()
  }, [yellowCtrl, orangeCtrl, pCtrl, lCtrl, mondayCtrl, compCtrl, footerCtrl])

  const letterSx: React.CSSProperties = {
    fontFamily: 'var(--font-jost)',
    fontSize: 'clamp(3.6rem, 8.5vw, 5.2rem)',
    fontWeight: 900,
    color: 'white',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  }

  return (
    <div className="flex flex-col items-center gap-0 w-full px-6 py-8">
      {/* MONDAY */}
      <motion.div
        animate={mondayCtrl}
        initial={{ opacity: 0, y: -16 }}
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.4em',
          marginBottom: 4,
        }}
      >
        MONDAY
      </motion.div>

      {/* P [○] [○] L — balls start off-screen left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP, overflow: 'visible' }}>
        <motion.span
          animate={pCtrl}
          initial={{ opacity: 0, x: -32 }}
          style={letterSx}
        >P</motion.span>

        {/* Orange ball — O1 (final left ball), starts way off-screen left */}
        <motion.div
          animate={orangeCtrl}
          initial={{ x: -700, opacity: 0.8, rotate: 0 }}
          style={{ transformOrigin: 'center center', flexShrink: 0 }}
        >
          <PoolBall hue="orange" />
        </motion.div>

        {/* Yellow ball — O2 (final right ball), starts off-screen left, temp at O1 */}
        <motion.div
          animate={yellowCtrl}
          initial={{ x: -700, opacity: 0.8, rotate: 0 }}
          style={{ transformOrigin: 'center center', flexShrink: 0 }}
        >
          <PoolBall hue="yellow" />
        </motion.div>

        <motion.span
          animate={lCtrl}
          initial={{ opacity: 0, x: 32 }}
          style={letterSx}
        >L</motion.span>
      </div>

      {/* COMP */}
      <motion.div
        animate={compCtrl}
        initial={{ opacity: 0, y: 16 }}
        style={{
          fontFamily: 'var(--font-jost)',
          fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
          fontWeight: 900,
          color: 'white',
          letterSpacing: '0.2em',
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        COMP
      </motion.div>

      {/* Footer */}
      <motion.div animate={footerCtrl} initial={{ opacity: 0 }} className="text-center mt-6 w-full">
        <div className="h-px bg-white/10 mb-4 w-28 mx-auto" />
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>
          Starts 9pm
        </p>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          in the Smiggins Hotel bar
        </p>
        <Link href="/pool" style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 10, display: 'inline-block' }} className="hover:text-white/70 transition-colors">
          Leaderboard →
        </Link>
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: '#1567A5' }}>

      {/* ── Hero ── */}
      <div className="flex flex-col items-center justify-center pt-12 pb-4 px-6">

        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-3"
        >
          <Image src="/smigginslogo-white.png" alt="Smiggins Hotel" width={140} height={70} className="object-contain" priority />
        </motion.div>

        <div className="flex items-center overflow-visible" style={{ gap: 2 }}>
          {LETTERS.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: LETTER_ORIGINS[i].x, y: LETTER_ORIGINS[i].y, rotate: LETTER_ORIGINS[i].rotate }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.72, delay: 0.5 + i * 0.07, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-white select-none"
              style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3.8rem, 13vw, 9.5rem)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.3 }}
          className="text-white/70 mt-1 mb-8"
          style={{ fontFamily: 'var(--font-dancing)', fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)', letterSpacing: '0.01em' }}
        >
          Hosted by Freddy Holler
        </motion.p>
      </div>

      {/* ── Cards ── */}
      <div className="flex-1 px-5 pb-10 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-5">

          {/* Pool Comp */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <PoolWordAnimation />
          </motion.div>

          {/* Trivia Tuesday */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.9, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Question mark area — ? is large, 4 Pines logo sits at the dot */}
            <div className="relative flex justify-center px-8 pt-6" style={{ height: 280 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 2.1 }}
                className="relative h-full"
              >
                {/* Question mark fills the height */}
                <Image
                  src="/questionmark.png"
                  alt=""
                  height={260}
                  width={163}
                  className="object-contain h-full w-auto"
                  style={{ opacity: 0.93 }}
                />

                {/* 4 Pines logo at the DOT — bottom ~80% of the ? image */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 2.4, ease: [0.22, 0.61, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '-2%',           // at the very bottom = dot of the ?
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Image
                    src="/4Pines_Logo_Colour_circle.png"
                    alt="4 Pines Brewing"
                    width={90}
                    height={90}
                    className="object-contain drop-shadow-xl"
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* TRIVIA TUESDAY */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 2.3 }}
              className="px-5 pt-4 pb-2 text-center"
              style={{ lineHeight: 0.88 }}
            >
              {['TRIVIA', 'TUESDAY'].map((word) => (
                <div key={word} className="text-white font-black uppercase" style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(2.8rem, 8vw, 5.2rem)', letterSpacing: '-0.02em' }}>
                  {word}
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.7, duration: 0.4 }}
              className="mt-auto px-6 pb-6 text-center"
            >
              <div className="h-px bg-white/10 mb-4" />
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>Starts 9pm</p>
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>in the Smiggins Hotel bar</p>
              <Link href="/trivia" style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 10, display: 'inline-block' }} className="hover:text-white/70 transition-colors">
                Leaderboard →
              </Link>
            </motion.div>
          </motion.div>

        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.9, duration: 0.6 }} className="pb-8 text-center">
        <Link href="/host/login" className="text-white/20 hover:text-white/50 text-xs transition-colors" style={{ fontFamily: 'var(--font-jost)' }}>
          Host Login
        </Link>
      </motion.div>
    </div>
  )
}
