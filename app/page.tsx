'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useAnimation } from 'framer-motion'
import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Audio — module-level singleton so it survives re-renders and can be unlocked
// by any user gesture before the animation plays.
// ─────────────────────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_ctx) {
    try {
      const C = (window as any).AudioContext ?? (window as any).webkitAudioContext
      _ctx = new C()
    } catch { return null }
  }
  return _ctx
}

function unlockAudio() {
  const ctx = getCtx()
  if (ctx?.state === 'suspended') ctx.resume()
}

function synthesize(ctx: AudioContext) {
  const now = ctx.currentTime

  // ── White-noise crack ──────────────────────────────────────────────────────
  const len  = Math.floor(ctx.sampleRate * 0.065)
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / ctx.sampleRate) * 120)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 2

  const ng = ctx.createGain()
  ng.gain.setValueAtTime(1.5, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.065)

  noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination)
  noise.start(now); noise.stop(now + 0.065)

  // ── High tonal crack ───────────────────────────────────────────────────────
  const o1 = ctx.createOscillator()
  o1.frequency.setValueAtTime(5400, now)
  o1.frequency.exponentialRampToValueAtTime(850, now + 0.04)
  const g1 = ctx.createGain()
  g1.gain.setValueAtTime(0.6, now)
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
  o1.connect(g1); g1.connect(ctx.destination)
  o1.start(now); o1.stop(now + 0.04)

  // ── Low body thud ──────────────────────────────────────────────────────────
  const o2 = ctx.createOscillator()
  o2.frequency.setValueAtTime(800, now)
  o2.frequency.exponentialRampToValueAtTime(160, now + 0.03)
  const g2 = ctx.createGain()
  g2.gain.setValueAtTime(0.4, now)
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  o2.connect(g2); g2.connect(ctx.destination)
  o2.start(now); o2.stop(now + 0.03)

  setTimeout(() => { try { ctx.close(); _ctx = null } catch { /**/ } }, 600)
}

function playBallCrack() {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => synthesize(ctx)).catch(() => {/**/ })
  } else {
    synthesize(ctx)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS letter scatter
// ─────────────────────────────────────────────────────────────────────────────
const LETTERS = ['E','V','E','N','T','S']
const ORIGINS = [
  { x: -300, y: -200, r: -60 }, { x:  200, y: -300, r:  45 },
  { x: -150, y:  250, r: -40 }, { x:  350, y:  150, r:  70 },
  { x: -400, y:  100, r: -55 }, { x:  250, y: -200, r:  35 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Pool Ball
// ─────────────────────────────────────────────────────────────────────────────
const BS = 96  // ball diameter in px
const CIRC = Math.PI * BS   // ~201 px per rotation

function PoolBall({ hue }: { hue: 'orange' | 'yellow' }) {
  const base  = hue === 'orange' ? '#E8820A' : '#E8CC00'
  const light = hue === 'orange' ? '#FFCA6A' : '#FFF08A'
  const dark  = hue === 'orange' ? '#7A3800' : '#967E00'
  const num   = hue === 'orange' ? '5' : '1'

  return (
    <div style={{
      width: BS, height: BS, borderRadius: '50%', flexShrink: 0, position: 'relative',
      background: `radial-gradient(circle at 33% 28%, ${light} 0%, ${base} 52%, ${dark} 100%)`,
      boxShadow: `inset -4px -5px 12px rgba(0,0,0,0.4), inset 4px 4px 8px rgba(255,255,255,0.22), 0 6px 18px rgba(0,0,0,0.55)`,
    }}>
      {/* gloss */}
      <div style={{
        position: 'absolute', top: '11%', left: '17%', width: '33%', height: '23%',
        borderRadius: '50%', background: 'rgba(255,255,255,0.3)', transform: 'rotate(-20deg)',
        pointerEvents: 'none',
      }} />
      {/* number circle */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: BS * 0.48, height: BS * 0.48, borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: BS * 0.26, fontWeight: 900, color: '#1a1a1a', fontFamily: 'var(--font-jost)', lineHeight: 1 }}>
            {num}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool Word Animation
//
// Layout: P [ORANGE=O1] [YELLOW=O2] L
//
// Physics:
//   yellow natural flex pos  = O2 = offset 0 from itself
//   orange natural flex pos  = O1 = offset 0 from itself
//   gap between balls in flex = GAP px
//
//   For yellow to sit visually AT O1:
//     yellow.x = -(BS + GAP)    ← shift left by one full ball+gap
//
//   For orange's right edge to just touch yellow's left edge at O1:
//     orange right edge  = orange.natural_pos + orange.x + BS/2
//     yellow left edge   = yellow.natural_pos + yellow.x - BS/2
//                        = O2 + (-(BS+GAP)) - BS/2
//                        = O1 + (BS+GAP) - (BS+GAP) - BS/2
//                        = O1 - BS/2
//     So: O1 + orange.x + BS/2 = O1 - BS/2
//         orange.x = -BS   ← orange stops one diameter left of O1
//
//   After impact: yellow → x=0 (O2), orange → x=0 (O1)
// ─────────────────────────────────────────────────────────────────────────────
const GAP = 4
const YELLOW_CONTACT_X = -(BS + GAP)   // -68: yellow at O1 visually
const ORANGE_CONTACT_X = -BS           // -64: orange right edge touching yellow left edge

// Realistic rotation = (travel distance / circumference) × 360
function deg(px: number) { return Math.round((px / CIRC) * 360) }

const START_X = -760  // off-screen left

function PoolWordAnimation() {
  const yCtrl = useAnimation()  // yellow (O2)
  const oCtrl = useAnimation()  // orange (O1)
  const pCtrl = useAnimation()
  const lCtrl = useAnimation()
  const monCtrl = useAnimation()
  const compCtrl = useAnimation()
  const footCtrl = useAnimation()

  useEffect(() => {
    // Unlock audio on any early user gesture
    const events = ['click','touchstart','scroll','keydown','mousemove'] as const
    const unlock = () => { unlockAudio(); events.forEach(e => document.removeEventListener(e, unlock)) }
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }))
    unlockAudio() // try immediately (works on desktop without gesture)

    async function run() {
      await new Promise(r => setTimeout(r, 300))

      // ── Yellow rolls in from left → stops at O1 position ──────────────────
      const yTravel = Math.abs(START_X - YELLOW_CONTACT_X) // 692px
      await yCtrl.start({
        x: YELLOW_CONTACT_X,
        rotate: deg(yTravel),   // clockwise = positive
        opacity: 1,
        transition: { duration: 0.85, ease: [0.22, 0.61, 0.36, 1] },
      })

      await new Promise(r => setTimeout(r, 180))

      // ── Orange rolls in from left → right edge just touches yellow ────────
      // ease: 'linear' = arrives at full rolling speed, NOT slowing before impact.
      // The collision itself is what stops it, not the easing curve.
      const oTravel = Math.abs(START_X - ORANGE_CONTACT_X)  // 696px
      await oCtrl.start({
        x: ORANGE_CONTACT_X,
        rotate: deg(oTravel),
        opacity: 1,
        transition: { duration: 0.78, ease: 'linear' },
      })

      // ── IMPACT ────────────────────────────────────────────────────────────
      playBallCrack()

      // Yellow shoots to O2 (x=0), orange settles at O1 (x=0)
      const afterYellow = deg(Math.abs(YELLOW_CONTACT_X))  // +68px more
      const afterOrange = deg(Math.abs(ORANGE_CONTACT_X))  // +64px more

      Promise.all([
        yCtrl.start({
          x: 0,
          rotate: deg(yTravel) + afterYellow,
          transition: { duration: 0.16, ease: [0.33, 1, 0.68, 1] },
        }),
        oCtrl.start({
          x: 0,
          rotate: deg(oTravel) + afterOrange,
          transition: { duration: 0.38, ease: 'easeOut' },
        }),
      ])

      await new Promise(r => setTimeout(r, 180))

      // P and L appear
      await Promise.all([
        pCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } }),
        lCtrl.start({ opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } }),
      ])

      await monCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } })
      await new Promise(r => setTimeout(r, 90))
      await compCtrl.start({ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } })
      await new Promise(r => setTimeout(r, 180))
      footCtrl.start({ opacity: 1, transition: { duration: 0.4 } })
    }

    run()

    return () => events.forEach(e => document.removeEventListener(e, unlock))
  }, [yCtrl, oCtrl, pCtrl, lCtrl, monCtrl, compCtrl, footCtrl])

  const letterSx: React.CSSProperties = {
    fontFamily: 'var(--font-jost)',
    fontSize: 'clamp(5.4rem, 12.75vw, 7.8rem)',
    fontWeight: 900, color: 'white',
    letterSpacing: '-0.02em', lineHeight: 1,
  }

  return (
    <div className="flex flex-col items-center w-full px-6 py-8" style={{ gap: 0, overflow: 'visible' }}>
      {/* MONDAY */}
      <motion.div animate={monCtrl} initial={{ opacity: 0, y: -16 }} style={{
        fontFamily: 'var(--font-jost)', fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
        fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.42em', marginBottom: 5,
      }}>MONDAY</motion.div>

      {/* P [O] [O] L */}
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP, overflow: 'visible' }}>
        <motion.span animate={pCtrl} initial={{ opacity: 0, x: -36 }} style={letterSx}>P</motion.span>

        {/* ORANGE — O1 (left ball), higher z so it appears in front when near yellow */}
        <motion.div
          animate={oCtrl}
          initial={{ x: START_X, opacity: 0.85, rotate: 0 }}
          style={{ flexShrink: 0, zIndex: 2 }}
        >
          <PoolBall hue="orange" />
        </motion.div>

        {/* YELLOW — O2 (right ball) */}
        <motion.div
          animate={yCtrl}
          initial={{ x: START_X, opacity: 0.85, rotate: 0 }}
          style={{ flexShrink: 0, zIndex: 1 }}
        >
          <PoolBall hue="yellow" />
        </motion.div>

        <motion.span animate={lCtrl} initial={{ opacity: 0, x: 36 }} style={letterSx}>L</motion.span>
      </div>

      {/* COMP */}
      <motion.div animate={compCtrl} initial={{ opacity: 0, y: 18 }} style={{
        fontFamily: 'var(--font-jost)', fontSize: 'clamp(2.7rem, 7.5vw, 4.2rem)',
        fontWeight: 900, color: 'white', letterSpacing: '0.2em', lineHeight: 1, marginTop: 3,
      }}>COMP</motion.div>

      {/* footer */}
      <motion.div animate={footCtrl} initial={{ opacity: 0 }} className="text-center mt-6 w-full">
        <div className="h-px bg-white/10 mb-4 w-28 mx-auto" />
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>Starts 8:30pm</p>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>in the Smiggins Hotel bar</p>
        <Link href="/pool" style={{
          display: 'inline-block', marginTop: 12,
          padding: '9px 28px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 999,
          fontFamily: 'var(--font-jost)', fontSize: '0.82rem', fontWeight: 700,
          color: 'white', letterSpacing: '0.06em', textDecoration: 'none',
          transition: 'background 0.2s',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
        onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >Leaderboard →</Link>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: '#1567A5' }}>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-12 pb-4 px-6">
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-3">
          <Image src="/smigginslogo-white.png" alt="Smiggins Hotel" width={140} height={70} className="object-contain" priority />
        </motion.div>

        <div className="flex items-center overflow-visible" style={{ gap: 2 }}>
          {LETTERS.map((letter, i) => (
            <motion.span key={i}
              initial={{ opacity: 0, x: ORIGINS[i].x, y: ORIGINS[i].y, rotate: ORIGINS[i].r }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.72, delay: 0.5 + i * 0.07, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-white select-none"
              style={{ fontFamily: 'var(--font-jost)', fontSize: 'clamp(3.8rem, 13vw, 9.5rem)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}
            >{letter}</motion.span>
          ))}
        </div>

        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1.3 }}
          className="text-white/70 mt-1 mb-8"
          style={{ fontFamily: 'var(--font-dancing)', fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)' }}
        >Hosted by Freddy Flyfingaz</motion.p>
      </div>

      {/* Cards */}
      <div className="flex-1 px-5 pb-10 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-5">

          {/* Pool Comp */}
          <motion.div
            initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <PoolWordAnimation />
          </motion.div>

          {/* Trivia Tuesday */}
          <motion.div
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 1.9, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/*
              The questionmark.png has a ~130px blank gap baked in between the hook body
              and its 2px rendered dot. Absolute positioning into that void never works.

              Solution: crop the image via overflow:hidden to show only the hook body
              (top 175px of 268px = 65% = just past where the body curl ends at ~63%).
              Then place the 4 Pines logo directly below with a natural dot-gap.
              Both are in a flex-col items-center, so both are at the card horizontal
              centre — perfectly aligned with TRIVIA TUESDAY below.
            */}
            <div className="flex flex-col items-center pt-6 pb-3">

              {/* Question mark body — cropped, blank gap removed */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 2.1 }}
                style={{ width: 110, height: 115, overflow: 'hidden' }}
              >
                <Image
                  src="/questionmark.png"
                  alt=""
                  height={268}
                  width={168}
                  style={{ display: 'block', opacity: 0.93, width: 110, height: 'auto' }}
                  priority
                />
              </motion.div>

              {/* Natural dot-gap */}
              <div style={{ height: 14 }} />

              {/* 4 Pines logo as the dot */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, delay: 2.4, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <Image src="/4Pines_Logo_Colour_circle.png" alt="4 Pines Brewing" width={68} height={68} className="object-contain drop-shadow-xl" />
              </motion.div>
            </div>

            {/* TRIVIA TUESDAY */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 2.3 }}
              className="px-5 pt-3 pb-2 text-center" style={{ lineHeight: 0.95 }}
            >
              <div style={{ fontFamily: 'var(--font-jost)', fontWeight: 900, color: 'white', fontSize: 'clamp(3rem, 9vw, 5.6rem)', letterSpacing: '-0.02em', lineHeight: 1 }}>TRIVIA</div>
              <div style={{ fontFamily: 'var(--font-jost)', fontWeight: 900, color: '#C8722A', fontSize: 'clamp(1.1rem, 3.2vw, 1.9rem)', letterSpacing: '0.3em', lineHeight: 1, marginTop: 4 }}>TUESDAY</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 2.7, duration: 0.4 }}
              className="mt-auto px-6 pb-6 text-center"
            >
              <div className="h-px bg-white/10 mb-4" />
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>Starts 9:00pm</p>
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>in the Smiggins Hotel bar</p>
              <Link href="/trivia" style={{
                display: 'inline-block', marginTop: 12,
                padding: '9px 28px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 999,
                fontFamily: 'var(--font-jost)', fontSize: '0.82rem', fontWeight: 700,
                color: 'white', letterSpacing: '0.06em', textDecoration: 'none',
                transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              >Leaderboard →</Link>
            </motion.div>
          </motion.div>

        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.9, duration: 0.6 }} className="pb-8 text-center">
        <Link href="/host/login" className="text-white/20 hover:text-white/50 text-xs transition-colors" style={{ fontFamily: 'var(--font-jost)' }}>Host Login</Link>
      </motion.div>
    </div>
  )
}
