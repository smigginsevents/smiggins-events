'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

function nextMonday() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default function NewKnockoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('Monday Pool Comp')
  const [date, setDate] = useState(nextMonday())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: dbErr } = await supabase
        .from('pool_tournaments')
        .insert({ name, event_date: date, status: 'setup' })
        .select('id')
        .single()
      if (dbErr) throw new Error(dbErr.message)
      router.push(`/host/pool/knockout/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Check the SQL migration has been run.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      <Link href="/host/pool/knockout" className="text-timber text-sm hover:text-navy block mb-4">← Tournaments</Link>
      <h1 className="text-2xl font-semibold text-navy mb-6">New Knockout Tournament</h1>

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-4">
          <Input
            label="Tournament Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <strong>Error:</strong> {error}
              {error.toLowerCase().includes('relation') || error.toLowerCase().includes('does not exist') ? (
                <p className="mt-1 text-xs text-red-500">
                  The database migration hasn&apos;t been run yet. Go to Supabase → SQL Editor and run <code>supabase/migrations/002_pool_knockout.sql</code>.
                </p>
              ) : null}
            </div>
          )}
          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Create & Set Up Players
          </Button>
        </Card>
      </form>
    </div>
  )
}
