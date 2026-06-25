'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function NewTriviaEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '4 Pines Trivia Night',
    event_date: new Date().toISOString().split('T')[0],
    num_rounds: 4,
    questions_per_round: 10,
    default_time_limit_seconds: 30,
  })

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // Create event
    const { data: event, error: eventError } = await supabase
      .from('trivia_events')
      .insert({
        name: form.name,
        event_date: form.event_date,
        default_time_limit_seconds: form.default_time_limit_seconds,
        status: 'draft',
      })
      .select('id')
      .single()

    if (eventError || !event) {
      setError('Failed to create event. Try again.')
      setLoading(false)
      return
    }

    // Create rounds
    const rounds = Array.from({ length: form.num_rounds }, (_, i) => ({
      event_id: event.id,
      round_number: i + 1,
      name: `Round ${i + 1}`,
    }))

    const { error: roundsError } = await supabase
      .from('trivia_rounds')
      .insert(rounds)

    if (roundsError) {
      setError('Event created but rounds failed. Check the questions page.')
      router.push(`/host/trivia/${event.id}/questions`)
      return
    }

    // Create placeholder questions
    const { data: createdRounds } = await supabase
      .from('trivia_rounds')
      .select('id, round_number')
      .eq('event_id', event.id)
      .order('round_number')

    if (createdRounds) {
      const questions = createdRounds.flatMap((round) =>
        Array.from({ length: form.questions_per_round }, (_, i) => ({
          round_id: round.id,
          question_number: i + 1,
          question_text: '',
          answer_text: '',
          media_type: 'none',
          points: 1,
        }))
      )
      await supabase.from('trivia_questions').insert(questions)
    }

    // Create live state row
    await supabase.from('trivia_live_state').insert({
      event_id: event.id,
      phase: 'lobby',
    })

    router.push(`/host/trivia/${event.id}/questions`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-navy mb-6">New Trivia Night</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Card>
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-5">Event Details</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Event Name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            <Input
              label="Date"
              type="date"
              value={form.event_date}
              onChange={(e) => set('event_date', e.target.value)}
              required
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-5">Structure</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Number of Rounds"
              type="number"
              min={1}
              max={10}
              value={form.num_rounds}
              onChange={(e) => set('num_rounds', Number(e.target.value))}
              required
            />
            <Input
              label="Questions per Round"
              type="number"
              min={1}
              max={30}
              value={form.questions_per_round}
              onChange={(e) => set('questions_per_round', Number(e.target.value))}
              required
            />
            <div className="col-span-2">
              <Input
                label="Default Time Limit (seconds)"
                type="number"
                min={5}
                max={300}
                value={form.default_time_limit_seconds}
                onChange={(e) => set('default_time_limit_seconds', Number(e.target.value))}
                required
              />
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={loading} size="lg">
            Create & Build Questions
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
