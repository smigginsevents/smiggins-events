'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function NewPoolEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: 'Monday Night Pool Comp',
    event_date: (() => {
      const d = new Date()
      // Snap to the nearest Monday
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    })(),
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: event } = await supabase
      .from('pool_events')
      .insert({ name: form.name, event_date: form.event_date, status: 'draft' })
      .select('id')
      .single()

    if (event) router.push(`/host/pool/${event.id}/scores`)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-navy mb-6">New Pool Comp Night</h1>

      <form onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-4">
          <Input
            label="Event Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Date"
            type="date"
            value={form.event_date}
            onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
            required
          />
          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Create & Enter Scores
          </Button>
        </Card>
      </form>
    </div>
  )
}
