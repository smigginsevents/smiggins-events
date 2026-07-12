'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

// ─── Media section ──────────────────────────────────────────────────────────
function MediaSection({
  q, roundId, idx, eventId, onUpdate, onSave,
}: {
  q: QuestionDraft
  roundId: string
  idx: number
  eventId: string
  onUpdate: (field: string, value: string | null) => void
  onSave: (patch?: Partial<QuestionDraft>) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'url' | 'upload'>(q.media_storage_path ? 'upload' : 'url')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (q.media_type === 'none') return null
  const isVideo = q.media_type === 'video'
  const accept = q.media_type === 'image' ? 'image/*' : 'audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${eventId}/${roundId}_q${idx + 1}_${Date.now()}.${ext}`
      if (q.media_storage_path) {
        await supabase.storage.from('trivia-media').remove([q.media_storage_path])
      }
      const { error: uploadErr } = await supabase.storage
        .from('trivia-media')
        .upload(path, file, { upsert: false, cacheControl: '3600' })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('trivia-media').getPublicUrl(path)
      onUpdate('media_url', publicUrl)
      onUpdate('media_storage_path', path)
      // Pass the new values explicitly — the state updates above haven't
      // flushed yet, so a plain onSave() would persist a stale question
      onSave({ media_url: publicUrl, media_storage_path: path })
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveUpload() {
    if (!q.media_storage_path) return
    const supabase = createClient()
    await supabase.storage.from('trivia-media').remove([q.media_storage_path])
    onUpdate('media_url', null)
    onUpdate('media_storage_path', null)
    onSave({ media_url: null, media_storage_path: null })
    setMode('url')
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {!isVideo && (
          <div className="flex rounded-md overflow-hidden border border-timber/25 text-xs flex-shrink-0">
            <button onClick={() => setMode('url')} className={`px-2.5 py-1 transition-colors ${mode === 'url' ? 'bg-navy text-white' : 'bg-snow-card text-navy/60 hover:bg-snow'}`}>URL</button>
            <button onClick={() => setMode('upload')} className={`px-2.5 py-1 transition-colors ${mode === 'upload' ? 'bg-navy text-white' : 'bg-snow-card text-navy/60 hover:bg-snow'}`}>Upload</button>
          </div>
        )}
        {(mode === 'url' || isVideo) && (
          <Input
            placeholder={q.media_type === 'video' ? 'YouTube URL' : 'https://…'}
            value={q.media_url ?? ''}
            onChange={e => onUpdate('media_url', e.target.value)}
            onBlur={() => onSave()}
            className="flex-1 text-xs"
          />
        )}
        {mode === 'upload' && !isVideo && (
          <div className="flex-1 flex items-center gap-2">
            {q.media_storage_path ? (
              <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
                <span className="text-xs text-green-700 flex-1 truncate">
                  {q.media_type === 'audio' ? '🎵' : '🖼️'} {q.media_storage_path.split('/').pop()}
                </span>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">Replace</button>
                <button onClick={handleRemoveUpload} className="text-xs text-red-400 hover:text-red-600">×</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-timber/30 rounded-md py-2 px-4 text-xs text-navy/50 hover:border-rust/50 hover:text-rust transition-colors disabled:opacity-60"
              >
                {uploading ? <><span className="animate-spin">↻</span> Uploading…</> : <><span>📎</span> Click to upload {q.media_type === 'audio' ? 'audio (MP3, WAV)' : 'image'}</>}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
          </div>
        )}
      </div>
      {q.media_url && (
        <div className="rounded-md overflow-hidden bg-navy/5 border border-timber/10">
          {q.media_type === 'image' && <img src={q.media_url} alt="Preview" className="max-h-32 max-w-full object-contain mx-auto block p-2" />}
          {q.media_type === 'audio' && <audio controls src={q.media_url} className="w-full h-9 my-1 px-2" />}
          {q.media_type === 'video' && q.media_url.includes('youtube') && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-navy/50"><span>▶</span><span className="truncate">{q.media_url}</span></div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Multiple choice editor ──────────────────────────────────────────────────
function MultipleChoiceSection({
  q, onUpdate, onSave,
}: {
  q: QuestionDraft
  onUpdate: (field: string, value: any) => void
  onSave: (patch?: Partial<QuestionDraft>) => void
}) {
  const options = q.multiple_choice_options ?? ['', '', '', '']
  const labels = ['A', 'B', 'C', 'D']

  function setOption(i: number, val: string) {
    const next = [...options]
    next[i] = val
    onUpdate('multiple_choice_options', next)
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs font-medium text-navy/60">Multiple Choice Options</p>
      <div className="grid grid-cols-2 gap-2">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${q.correct_option_index === i ? 'bg-pine text-white' : 'bg-navy/10 text-navy/50'}`}>
              {label}
            </span>
            <input
              type="text"
              value={options[i] ?? ''}
              onChange={e => setOption(i, e.target.value)}
              onBlur={() => onSave()}
              placeholder={`Option ${label}`}
              className="flex-1 rounded border border-timber/30 px-2 py-1 text-xs text-navy bg-snow-card focus:outline-none focus:ring-1 focus:ring-rust"
            />
            <button
              type="button"
              title="Mark as correct"
              onClick={() => { onUpdate('correct_option_index', i); onSave({ correct_option_index: i }) }}
              className={`text-xs px-1.5 py-1 rounded transition-colors ${q.correct_option_index === i ? 'bg-pine text-white' : 'text-navy/30 hover:text-pine'}`}
            >
              ✓
            </button>
          </div>
        ))}
      </div>
      {q.correct_option_index != null && options[q.correct_option_index] && (
        <p className="text-xs text-pine/70">Correct: <span className="font-semibold">{labels[q.correct_option_index]}. {options[q.correct_option_index]}</span></p>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
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
  const [editingRound, setEditingRound] = useState<string | null>(null)
  const [roundDrafts, setRoundDrafts] = useState<Record<string, { name: string; description: string }>>({})

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: evt }, { data: rds }] = await Promise.all([
      supabase.from('trivia_events').select('*').eq('id', eventId).single(),
      supabase.from('trivia_rounds').select('*').eq('event_id', eventId).order('round_number'),
    ])
    setEvent(evt)
    setRounds(rds ?? [])

    if (rds && rds.length > 0) {
      const { data: qs } = await supabase
        .from('trivia_questions')
        .select('*')
        .in('round_id', rds.map(r => r.id))
        .order('question_number')
      const byRound: Record<string, QuestionDraft[]> = {}
      for (const round of rds) {
        byRound[round.id] = (qs ?? []).filter(q => q.round_id === round.id)
      }
      setQuestions(byRound)
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadData() }, [loadData])

  function updateQuestion(roundId: string, idx: number, field: string, value: any) {
    setQuestions(prev => {
      const updated = [...(prev[roundId] ?? [])]
      updated[idx] = { ...updated[idx], [field]: value, dirty: true }
      return { ...prev, [roundId]: updated }
    })
  }

  async function saveQuestion(roundId: string, idx: number, patch?: Partial<QuestionDraft>) {
    const base = questions[roundId]?.[idx]
    if (!base) return
    // A patch carries values that were just set but may not have flushed to
    // state yet (e.g. media upload) — merge it and always treat as dirty
    const q = patch ? { ...base, ...patch, dirty: true } : base
    if (!q.dirty) return
    if (!q.question_text.trim() || !q.answer_text.trim()) return

    const key = `${roundId}-${idx}`
    setSaving(s => ({ ...s, [key]: true }))

    const supabase = createClient()
    const payload = {
      round_id: roundId,
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: q.answer_text,
      multiple_choice_options: q.multiple_choice_options ?? null,
      correct_option_index: q.correct_option_index ?? null,
      media_type: q.media_type,
      media_url: q.media_url,
      media_storage_path: q.media_storage_path,
      points: q.points,
    }

    if (q.id) {
      await supabase.from('trivia_questions').update(payload).eq('id', q.id)
    } else {
      const { data } = await supabase.from('trivia_questions').insert(payload).select('id').single()
      if (data) {
        setQuestions(prev => {
          const updated = [...(prev[roundId] ?? [])]
          updated[idx] = { ...updated[idx], id: data.id, dirty: false }
          return { ...prev, [roundId]: updated }
        })
      }
    }

    setQuestions(prev => {
      const updated = [...(prev[roundId] ?? [])]
      updated[idx] = { ...updated[idx], dirty: false }
      return { ...prev, [roundId]: updated }
    })
    setSaving(s => ({ ...s, [key]: false }))
  }

  async function saveRound(roundId: string) {
    const draft = roundDrafts[roundId]
    if (!draft) return
    const supabase = createClient()
    await supabase.from('trivia_rounds')
      .update({ name: draft.name, description: draft.description || null })
      .eq('id', roundId)
    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, ...draft, description: draft.description || null } : r))
    setEditingRound(null)
  }

  async function addQuestion(roundId: string) {
    const existing = questions[roundId] ?? []
    setQuestions(prev => ({
      ...prev,
      [roundId]: [...(prev[roundId] ?? []), {
        round_id: roundId,
        question_number: existing.length + 1,
        question_text: '',
        answer_text: '',
        multiple_choice_options: null,
        correct_option_index: null,
        media_type: 'none' as MediaType,
        media_url: null,
        media_storage_path: null,
        points: 1,
        dirty: false,
      }],
    }))
  }

  async function removeQuestion(roundId: string, idx: number) {
    const q = questions[roundId]?.[idx]
    if (!q) return
    const supabase = createClient()
    if (q.media_storage_path) {
      await supabase.storage.from('trivia-media').remove([q.media_storage_path])
    }
    if (q.id) {
      await supabase.from('trivia_questions').delete().eq('id', q.id)
    }

    // Renumber remaining questions sequentially and sync to DB
    const remaining = (questions[roundId] ?? []).filter((_, i) => i !== idx)
    const renumbered = remaining.map((item, i) => ({ ...item, question_number: i + 1 }))
    setQuestions(prev => ({ ...prev, [roundId]: renumbered }))

    // Update any whose number changed
    await Promise.all(
      renumbered
        .filter((item, i) => item.id && remaining[i].question_number !== item.question_number)
        .map(item => supabase.from('trivia_questions').update({ question_number: item.question_number }).eq('id', item.id!))
    )
  }

  async function markReady() {
    const supabase = createClient()
    await supabase.from('trivia_events').update({ status: 'ready' }).eq('id', eventId)
    router.push(`/host/trivia/${eventId}/teams`)
  }

  const totalFilled = Object.values(questions).flat().filter(q => q.question_text.trim() && q.answer_text.trim()).length
  const totalSlots = Object.values(questions).flat().length

  if (loading) return <p className="text-navy/40 text-sm py-12 text-center">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/host" className="text-timber text-sm hover:text-navy transition-colors">← Dashboard</Link>
          <h1 className="text-2xl font-semibold text-navy mt-1">{event?.name}</h1>
          <p className="text-navy/50 text-sm">
            {new Date(event?.event_date ?? '').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
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
            variant="primary" size="sm" onClick={markReady}
            disabled={totalFilled < totalSlots || totalSlots === 0}
            title={totalFilled < totalSlots ? `${totalFilled}/${totalSlots} questions filled` : 'Mark ready'}
          >
            Mark Ready
          </Button>
        </div>
      </div>

      <p className="text-sm text-navy/50">{totalFilled}/{totalSlots} questions filled</p>

      {showCSV && <CSVImport eventId={eventId} rounds={rounds} onImported={loadData} />}

      {rounds.map(round => (
        <Card key={round.id} padded={false}>
          {/* Round header */}
          <div className="px-6 py-4 border-b border-timber/10">
            {editingRound === round.id ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="round">R{round.round_number}</Badge>
                  <input
                    autoFocus
                    value={roundDrafts[round.id]?.name ?? round.name}
                    onChange={e => setRoundDrafts(prev => ({ ...prev, [round.id]: { ...prev[round.id], name: e.target.value } }))}
                    className="flex-1 font-semibold text-navy border-b border-rust outline-none bg-transparent"
                  />
                </div>
                <input
                  value={roundDrafts[round.id]?.description ?? (round.description ?? '')}
                  onChange={e => setRoundDrafts(prev => ({ ...prev, [round.id]: { ...prev[round.id], description: e.target.value } }))}
                  placeholder="Round description (shown on display screen)…"
                  className="text-sm text-navy/60 border-b border-timber/30 outline-none bg-transparent w-full"
                />
                <div className="flex gap-2 mt-1">
                  <Button size="sm" onClick={() => saveRound(round.id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingRound(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="round">R{round.round_number}</Badge>
                  <div>
                    <h2 className="font-semibold text-navy">{round.name}</h2>
                    {round.description && <p className="text-xs text-navy/40 mt-0.5 italic">{round.description}</p>}
                  </div>
                  {round.time_limit_seconds && (
                    <span className="text-xs text-navy/40">{round.time_limit_seconds}s limit</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setRoundDrafts(prev => ({ ...prev, [round.id]: { name: round.name, description: round.description ?? '' } }))
                    setEditingRound(round.id)
                  }}
                  className="text-xs text-navy/30 hover:text-navy transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col gap-3">
            {(questions[round.id] ?? []).map((q, idx) => (
              <div key={idx} className="bg-snow rounded-lg p-4 border border-timber/10">
                {/* Q header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-timber">Q{q.question_number}</span>
                    {q.multiple_choice_options && (
                      <span className="text-xs bg-rust/10 text-rust px-1.5 py-0.5 rounded font-medium">MC</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={q.points}
                      onChange={e => updateQuestion(round.id, idx, 'points', Number(e.target.value))}
                      className="text-xs border border-timber/30 rounded px-2 py-1 bg-snow-card text-navy"
                    >
                      {[1, 2, 3].map(p => <option key={p} value={p}>{p} pt{p > 1 ? 's' : ''}</option>)}
                    </select>
                    {q.dirty && (
                      <Button size="sm" variant="primary" onClick={() => saveQuestion(round.id, idx)} loading={saving[`${round.id}-${idx}`]} disabled={!q.question_text.trim() || !q.answer_text.trim()}>
                        Save
                      </Button>
                    )}
                    <button onClick={() => removeQuestion(round.id, idx)} className="text-navy/30 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </div>
                </div>

                {/* Question + Answer */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-navy/60 mb-1 block">Question</label>
                    <textarea
                      value={q.question_text}
                      onChange={e => updateQuestion(round.id, idx, 'question_text', e.target.value)}
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
                      onChange={e => updateQuestion(round.id, idx, 'answer_text', e.target.value)}
                      onBlur={() => saveQuestion(round.id, idx)}
                      placeholder="Enter answer…"
                      rows={2}
                      className="w-full rounded-md border border-timber/30 px-3 py-2 text-sm text-navy bg-snow-card resize-none focus:outline-none focus:ring-2 focus:ring-rust placeholder:text-navy/30"
                    />
                  </div>
                </div>

                {/* Multiple choice toggle */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!q.multiple_choice_options}
                      onChange={e => {
                        if (e.target.checked) {
                          updateQuestion(round.id, idx, 'multiple_choice_options', ['', '', '', ''])
                        } else {
                          updateQuestion(round.id, idx, 'multiple_choice_options', null)
                          updateQuestion(round.id, idx, 'correct_option_index', null)
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-navy/60 font-medium">Multiple choice (A/B/C/D)</span>
                  </label>
                </div>

                {q.multiple_choice_options && (
                  <MultipleChoiceSection
                    q={q}
                    onUpdate={(field, value) => updateQuestion(round.id, idx, field, value)}
                    onSave={patch => saveQuestion(round.id, idx, patch)}
                  />
                )}

                {/* Media */}
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={q.media_type}
                      onChange={e => {
                        const mediaType = e.target.value as MediaType
                        updateQuestion(round.id, idx, 'media_type', mediaType)
                        if (mediaType === 'none') {
                          updateQuestion(round.id, idx, 'media_url', null)
                          updateQuestion(round.id, idx, 'media_storage_path', null)
                          saveQuestion(round.id, idx, { media_type: mediaType, media_url: null, media_storage_path: null })
                        } else {
                          saveQuestion(round.id, idx, { media_type: mediaType })
                        }
                      }}
                      className="text-xs border border-timber/30 rounded px-2 py-1 bg-snow-card text-navy"
                    >
                      <option value="none">No media</option>
                      <option value="image">Image</option>
                      <option value="video">Video (YouTube)</option>
                      <option value="audio">Audio</option>
                    </select>
                    {q.media_type !== 'none' && (
                      <span className="text-xs text-navy/40">
                        {q.media_type === 'video' ? 'Paste a YouTube URL' : 'Paste a URL or upload a file'}
                      </span>
                    )}
                  </div>
                  <MediaSection
                    q={q} roundId={round.id} idx={idx} eventId={eventId}
                    onUpdate={(field, value) => updateQuestion(round.id, idx, field, value)}
                    onSave={patch => saveQuestion(round.id, idx, patch)}
                  />
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
