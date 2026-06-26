'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTournament } from '@/app/actions/pool'
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
  const [name, setName] = useState('Monday Pool Comp')
  const [date, setDate] = useState(nextMonday())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const id = await createTournament(name, date)
    router.push(`/host/pool/knockout/${id}`)
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
          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Create & Set Up Players
          </Button>
        </Card>
      </form>
    </div>
  )
}
