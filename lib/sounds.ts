'use client'

const sounds = {
  tick: '/sounds/tick.mp3',
  buzzer: '/sounds/buzzer.mp3',
  drumroll: '/sounds/drumroll.mp3',
  fanfare: '/sounds/fanfare.mp3',
  reveal: '/sounds/reveal.mp3',
} as const

type SoundName = keyof typeof sounds

const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {}

export function playSound(name: SoundName, volume = 0.7) {
  if (typeof window === 'undefined') return

  try {
    if (!audioCache[name]) {
      const audio = new Audio(sounds[name])
      audio.preload = 'auto'
      audioCache[name] = audio
    }
    const audio = audioCache[name]!
    audio.currentTime = 0
    audio.volume = volume
    audio.play().catch(() => {
      // Autoplay blocked — silently ignore
    })
  } catch {
    // File not found or browser restriction — silently skip
  }
}

export function stopSound(name: SoundName) {
  const audio = audioCache[name]
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
}
