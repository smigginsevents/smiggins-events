'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function HostLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    router.push('/host')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-snow flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-display text-4xl text-navy tracking-wide">SMIGGINS</span>
          <p className="text-timber text-sm mt-1 tracking-widest uppercase">Host Login</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-snow-card rounded-xl border border-timber/20 shadow-sm p-8 flex flex-col gap-5"
        >
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
            Sign in
          </Button>
        </form>

        <p className="text-center text-timber/60 text-xs mt-6">
          smiggins.events — host only
        </p>
      </div>
    </div>
  )
}
