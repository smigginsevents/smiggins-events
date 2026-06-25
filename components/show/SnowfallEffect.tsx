'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  opacity: number
}

export function SnowfallEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Particle[] = []

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 3 + 1,
        speed: Math.random() * 0.8 + 0.3,
        drift: Math.random() * 0.4 - 0.2,
        opacity: Math.random() * 0.4 + 0.1,
      })
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(247,244,237,${p.opacity})`
        ctx!.fill()
        p.y += p.speed
        p.x += p.drift
        if (p.y > canvas!.height) {
          p.y = -5
          p.x = Math.random() * canvas!.width
        }
        if (p.x > canvas!.width) p.x = 0
        if (p.x < 0) p.x = canvas!.width
      }
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  )
}
