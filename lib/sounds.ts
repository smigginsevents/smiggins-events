'use client'

// ─── Web Audio context (singleton) ───────────────────────────────────────────
let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) {
      const C = (window as any).AudioContext ?? (window as any).webkitAudioContext
      _ctx = new C()
    }
    if (_ctx && _ctx.state === 'suspended') _ctx.resume()
    return _ctx
  } catch {
    return null
  }
}

// ─── Countdown beep (called each second 10 → 1) ──────────────────────────────
// Pitch rises as seconds fall to build urgency: 880 Hz at 10s → 1320 Hz at 1s
export function playCountdownBeep(secondsRemaining: number) {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime
  const freq = 880 + (10 - Math.max(1, Math.min(10, secondsRemaining))) * 55
  const duration = 0.09

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, now)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.55, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

// ─── End-of-time buzzer ───────────────────────────────────────────────────────
// Classic low-end game show buzzer: layered sawtooth + square + noise burst
export function playBuzzer() {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime
  const duration = 1.6

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.7, now)
  master.gain.setValueAtTime(0.7, now + 0.04)
  master.gain.exponentialRampToValueAtTime(0.001, now + duration)
  master.connect(ctx.destination)

  // Low sawtooth — the "blaaarp" foundation
  const osc1 = ctx.createOscillator()
  osc1.type = 'sawtooth'
  osc1.frequency.setValueAtTime(120, now)
  osc1.frequency.exponentialRampToValueAtTime(85, now + duration)
  const g1 = ctx.createGain(); g1.gain.value = 0.50
  osc1.connect(g1); g1.connect(master)

  // Slightly detuned square — adds fuzz + buzz character
  const osc2 = ctx.createOscillator()
  osc2.type = 'square'
  osc2.frequency.setValueAtTime(124, now)
  osc2.frequency.exponentialRampToValueAtTime(88, now + duration)
  const g2 = ctx.createGain(); g2.gain.value = 0.28
  osc2.connect(g2); g2.connect(master)

  // Octave-up sawtooth — gritty harmonic overtone
  const osc3 = ctx.createOscillator()
  osc3.type = 'sawtooth'
  osc3.frequency.setValueAtTime(240, now)
  osc3.frequency.exponentialRampToValueAtTime(170, now + duration)
  const g3 = ctx.createGain(); g3.gain.value = 0.14
  osc3.connect(g3); g3.connect(master)

  // Noise burst at attack for percussive impact
  const bufLen = Math.floor(ctx.sampleRate * 0.06)
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015))
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const g4 = ctx.createGain(); g4.gain.value = 0.35
  noise.connect(g4); g4.connect(master)

  osc1.start(now); osc1.stop(now + duration)
  osc2.start(now); osc2.stop(now + duration)
  osc3.start(now); osc3.stop(now + duration)
  noise.start(now)
}

// ─── MP3-based sounds (reveal, drumroll, fanfare) ─────────────────────────────
const MP3_SOUNDS = {
  reveal:   '/sounds/reveal.mp3',
  drumroll: '/sounds/drumroll.mp3',
  fanfare:  '/sounds/fanfare.mp3',
} as const

type Mp3Sound = keyof typeof MP3_SOUNDS
const mp3Cache: Partial<Record<Mp3Sound, HTMLAudioElement>> = {}

export function playSound(name: Mp3Sound, volume = 0.7) {
  if (typeof window === 'undefined') return
  try {
    if (!mp3Cache[name]) {
      const audio = new Audio(MP3_SOUNDS[name])
      audio.preload = 'auto'
      mp3Cache[name] = audio
    }
    const audio = mp3Cache[name]!
    audio.currentTime = 0
    audio.volume = volume
    audio.play().catch(() => {})
  } catch {}
}

export function stopSound(name: Mp3Sound) {
  const audio = mp3Cache[name]
  if (audio) { audio.pause(); audio.currentTime = 0 }
}
