'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { TriviaEvent, TriviaRound, TriviaQuestion, MediaType } from '@/lib/types'
import { CSVImport } from '@/components/trivia/CSVImport'

interface QuestionDraft extends Omit<TriviaQuestion, 'id'> {
  id?: string
  dirty?: boolean
}

export default function QuestionsPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [event, setEvent] = useState<TriviaEvent | null>(null)
  const [rounds, setRounds] = useState<TriviaRound[]>([])
  const [questions, setQuestions] = useState<Record<string, QuestionDraft[]>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [showCSV, setShowCSV] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()

    const [{ data: evt }, { data: rds }, { data: qs }] = await Promise.all([
      supabase.from('trivia_events').select('*').eq('id', eventId).single(),
      supabase.from('trivia_rounds').select('*').eq('event_id', eventId).order('round_number'),
      supabase.from('trivia_questions')
        .select('*')
        .in('round_id',
          (await supabase.from('trivia_rounds').select('id').eq('event_id', eventId))
            .data?.map((r) => r.id) ?? []
        )
        .order('question_number'),
    ])

    setEvent(evt)
    setRounds(rds ?? [])

    const byRound: Record<string, QuestionDraft[]> = {}
    for (const round of (rds ?? [])) {
      byRound[round.id] = (qs ?? []).filter((q) => q.round_id === round.id)
    }
    setQuestions(byRound)
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadData() }, [loadData])

  function updateQuestion(roundId: string, idx: number, field: string, value: string | number) {
    setQuestions((prev) => {
      const updated = [...(prev[roundId] ?? [])]
      updated[idx] = { ...updated[idx], [field]: value, dirty: true }
      return { ...prev, [roundId]: updated }
    })
  }

  async function saveQuestion(roundId: string, idx: number) {
    const q = questions[roundId]?.[idx]
    if (!q || !q.dirty) return
    if (!q.question_text.trim() || !q.answer_text.trim()) return

    const key = `${roundId}-${idx}`
    setSaving((s) => ({ ...s, [key]: true }))

    const supabase = createClient()
    const payload = {
      round_id: roundId,
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: q.answer_text,
      media_type: q.media_type,
      media_url: q.media_url,
      points: q.points,
    }

    if (q.id) {
      await supabase.from('trivia_questions').update(payload).eq('id', q.id)
    } else {
      const { data } = await supabase.from('trivia_questions').insert(payload).select('id').single()
      if (data) {
        setQuestions((prev) => {
          const updated = [...(prev[roundId] ?? [])]
          updated[idx] = { ...updated[idx], id: data.id, dirty: false }
          return { ...prev, [roundId]: updated }
        })
      }
    }

    setQuestions((prev) => {
      const updated = [...(prev[roundId] ?? [])]
      updated[idx] = { ...updated[idx], dirty: false }
      return { ...prev, [roundId]: updated }
    })
    setSaving((s) => ({ ...s, [key]: false }))
  }

  async function addQuestion(roundId: string) {
    const existing = questions[roundId] ?? []
    const nextNum = existing.length + 1
    setQuestions((prev) => ({
      ...prev,
      [roundId]: [
        ...(prev[roundId] ?? []),
        {
          round_id: roundId,
          question_number: nextNum,
          question_text: '',
          answer_text: '',
          media_type: 'none',
          media_url: null,
          media_storage_path: null,
          points: 1,
          dirty: false,
        },
      ],
    }))
  }

  async function removeQuestion(roundId: string, idx: number) {
    const q = questions[roundId]?.[idx]
    if (q?.id) {
      const supabase = createClient()
      await supabase.from('trivia_questions').delete().eq('id', q.id)
    }
    setQuestions((prev) => {
      const updated = (prev[roundId] ?? []).filter((_, i) => i !== idx)
      return { ...prev, [roundId]: updated }
    })
  }

  async function markReady() {
    const supabase = createClient()
    await supabase.from('trivia_events').update({ status: 'ready' }).eq('id', eventId)
    router.push(`/host/trivia/${eventId}/teams`)
  }

  const totalFilled = Object.values(questions).flat().filter(
    (q) => q.question_text.trim() && q.answer_text.trim()
  ).length
  const totalSlots = Object.values(questions).flat().length

  if (loading) {
    return <p className="text-navy/40 text-sm py-12 text-center">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/host" className="text-timber text-sm hover:text-navy transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-navy mt-1">{event?.name}</h1>
          <p className="text-navy/50 text-sm">
            {new Date(event?.event_date ?? '').toLocaleDateString('en-AU', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowCSV(!showCSV)}>
            {showCSV ? 'Close CSV' : 'Import CSV'}
          </Button>
          <Link href={`/host/trivia/${eventId}/teams`}>
            <Button variant="ghost" size="sm">Teams →</Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={markReady}
            disabled={totalFilled < totalSlots}
            title={totalFilled < totalSlots ? `${totalFilled}/${totalSlots} questions filled` : 'Mark ready'}
          >
            Mark Ready
          </Button>
        </div>
      </div>

      <p className="text-sm text-navy/50">
        {totalFilled}/{totalSlots} questions filled
      </p>

      {/* CSV Import */}
      {showCSV && (
        <CSVImport eventId={eventId} rounds={rounds} onImported={loadData} />
      )}

      {/* Rounds */}
      {rounds.map((round) => (
        <Card key={round.id} padded={false}>
          <div className="px-6 py-4 border-b border-timber/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="round">R{round.round_number}</Badge>
              <h2 className="font-semibold text-navy">{round.name}</h2>
              {round.time_limit_seconds && (
                <span className="text-xs text-navy/40">{round.time_limit_seconds}s limit</span>
              )}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {(questions[round.id] ?? []).map((q, idx) => (
              <div key={idx} className="bg-snow rounded-lg p-4 border border-timber/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-timber">Q{q.question_number}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={q.points}
                      onChange={(e) => updateQuestion(round.id, idx, 'points', Number(e.target.value))}
                      className="text-xs border border-timber/30 rounded px-2 py-1 bg-snow-card text-navy"
                    >
                      {[1, 2, 3].map((p) => (
                        <option key={p} value={p}>{p} pt{p > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    {q.dirty && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => saveQuestion(round.id, idx)}
                        loading={saving[`${round.id}-${idx}`]}
                        disabled={!q.question_text.trim() || !q.answer_text.trim()}
                      >
                        Save
                      </Button>
                    )}
                    <button
                      onClick={() => removeQuestion(round.id, idx)}
                      className="text-navy/30 hover:text-red-500 transition-colors text-lg leading-none"
                      title="Remove question"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-navy/60 mb-1 block">Question</label>
                    <textarea
                      value={q.question_text}
                      onChange={(e) => updateQuestion(round.id, idx, 'question_text', e.target.value)}
                      onBlur={() => saveQuestion(round.id, idx)}
                      placeholder="Enter question…"
                      rows={2}
                      className="w-full rounded-md border border-timber/30 px-3 py-2 text-sm text-navy bg-snow-card resize-none focus:outline-none focus:ring-2 focus:ring-rust placeholder:text-navy/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy/60 mb-1 block">Answer</label>
                    <textarea
                      value={q.answer_text}
                      onChange={(e) => updateQuestion(round.id, idx, 'answer_text', e.target.value)}
                      onBlur={() => saveQuestion(round.id, idx)}
                      placeholder="Enter answer…"
                      rows={2}
                      className="w-full rounded-md border border-timber/30 px-3 py-2 text-sm text-navy bg-snow-card resize-none focus:outline-none focus:ring-2 focus:ring-rust placeholder:text-navy/30"
                    />
                  </div>
                </div>

                {/* Media */}
                <div className="mt-3 flex items-center gap-3">
                  <select
                    value={q.media_type}
                    onChange={(e) => updateQuestion(round.id, idx, 'media_type', e.target.value as MediaType)}
                    className="text-xs border border-timber/30 rounded px-2 py-1 bg-snow-card text-navy"
                  >
                    <option value="none">No media</option>
                    <option value="image">Image</option>
                    <option value="video">Video (YouTube)</option>
                    <option value="audio">Audio</option>
                  </select>
                  {q.media_type !== 'none' && (
                    <Input
                      placeholder={q.media_type === 'video' ? 'YouTube URL' : 'Media URL'}
                      value={q.media_url ?? ''}
                      onChange={(e) => updateQuestion(round.id, idx, 'media_url', e.target.value)}
                      onBlur={() => saveQuestion(round.id, idx)}
                      className="flex-1 text-xs"
                    />
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={() => addQuestion(round.id)}
              className="text-sm text-rust hover:text-rust/70 transition-colors py-2 text-center border border-dashed border-rust/30 rounded-lg hover:border-rust/60"
            >
              + Add Question
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
