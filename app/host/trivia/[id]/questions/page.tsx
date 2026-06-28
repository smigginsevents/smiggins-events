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

// ─────────────────────────────────────────────────────────────────────────────
// Media section — URL input + file upload toggle
// ─────────────────────────────────────────────────────────────────────────────
function MediaSection({
  q, roundId, idx, eventId, onUpdate, onSave,
}: {
  q: QuestionDraft
  roundId: string
  idx: number
  eventId: string
  onUpdate: (field: string, value: string | null) => void
  onSave: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [mode, setMode] = useState<'url' | 'upload'>(
    q.media_storage_path ? 'upload' : 'url'
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (q.media_type === 'none') return null

  const isVideo = q.media_type === 'video'
  const accept  = q.media_type === 'image' ? 'image/*' : 'audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      // Path: eventId/roundId_questionIdx_timestamp.ext — unique enough to avoid collisions
      const path = `${eventId}/${roundId}_q${idx + 1}_${Date.now()}.${ext}`

      // If replacing an old uploaded file, delete it first
      if (q.media_storage_path) {
        await supabase.storage.from('trivia-media').remove([q.media_storage_path])
      }

      const { error: uploadErr } = await supabase.storage
        .from('trivia-media')
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: { publicUrl } } = supabase.storage
        .from('trivia-media')
        .getPublicUrl(path)

      onUpdate('media_url', publicUrl)
      onUpdate('media_storage_path', path)
      onSave()
      setUploadProgress(100)
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveUpload() {
    if (!q.media_storage_path) return
    const supabase = createClient()
    await supabase.storage.from('trivia-media').remove([q.media_storage_path])
    onUpdate('media_url', null)
    onUpdate('media_storage_path', null)
    onSave()
    setMode('url')
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Mode toggle — video stays URL-only */}
        {!isVideo && (
          <div className="flex rounded-md overflow-hidden border border-timber/25 text-xs flex-shrink-0">
            <button
              onClick={() => setMode('url')}
              className={`px-2.5 py-1 transition-colors ${mode === 'url' ? 'bg-navy text-white' : 'bg-snow-card text-navy/60 hover:bg-snow'}`}
            >
              URL
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`px-2.5 py-1 transition-colors ${mode === 'upload' ? 'bg-navy text-white' : 'bg-snow-card text-navy/60 hover:bg-snow'}`}
            >
              Upload
            </button>
          </div>
        )}

        {/* URL mode */}
        {(mode === 'url' || isVideo) && (
          <Input
            placeholder={q.media_type === 'video' ? 'YouTube URL' : 'https://…'}
            value={q.media_url ?? ''}
            onChange={e => onUpdate('media_url', e.target.value)}
            onBlur={onSave}
            className="flex-1 text-xs"
          />
        )}

        {/* Upload mode */}
        {mode === 'upload' && !isVideo && (
          <div className="flex-1 flex items-center gap-2">
            {q.media_storage_path ? (
              /* File already uploaded — show filename + remove */
              <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
                <span className="text-xs text-green-700 flex-1 truncate">
                  {q.media_type === 'audio' ? '🎵' : '🖼️'}{' '}
                  {q.media_storage_path.split('/').pop()}
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                >
                  Replace
                </button>
                <button
                  onClick={handleRemoveUpload}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ) : (
              /* No file yet — drop / click zone */
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-timber/30 rounded-md py-2 px-4 text-xs text-navy/50 hover:border-rust/50 hover:text-rust transition-colors disabled:opacity-60"
              >
                {uploading ? (
                  <><span className="animate-spin">↻</span> Uploading…</>
                ) : (
                  <><span>📎</span> Click to upload {q.media_type === 'audio' ? 'audio (MP3, WAV)' : 'image'}</>
                )}
              </button>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Preview */}
      {q.media_url && (
        <div className="rounded-md overflow-hidden bg-navy/5 border border-timber/10">
          {q.media_type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.media_url} alt="Preview" className="max-h-32 max-w-full object-contain mx-auto block p-2" />
          )}
          {q.media_type === 'audio' && (
            <audio controls src={q.media_url} className="w-full h-9 my-1 px-2" />
          )}
          {q.media_type === 'video' && q.media_url.includes('youtube') && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-navy/50">
              <span>▶</span>
              <span className="truncate">{q.media_url}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
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

  function updateQuestion(roundId: string, idx: number, field: string, value: string | number | null) {
    setQuestions(prev => {
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
    setSaving(s => ({ ...s, [key]: true }))

    const supabase = createClient()
    const payload = {
      round_id: roundId,
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: q.answer_text,
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

  async function addQuestion(roundId: string) {
    const existing = questions[roundId] ?? []
    setQuestions(prev => ({
      ...prev,
      [roundId]: [
        ...(prev[roundId] ?? []),
        {
          round_id: roundId,
          question_number: existing.length + 1,
          question_text: '',
          answer_text: '',
          media_type: 'none' as MediaType,
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
    if (!q) return

    const supabase = createClient()

    // Clean up storage file if one was uploaded
    if (q.media_storage_path) {
      await supabase.storage.from('trivia-media').remove([q.media_storage_path])
    }

    if (q.id) {
      await supabase.from('trivia_questions').delete().eq('id', q.id)
    }

    setQuestions(prev => ({
      ...prev,
      [roundId]: (prev[roundId] ?? []).filter((_, i) => i !== idx),
    }))
  }

  async function markReady() {
    const supabase = createClient()
    await supabase.from('trivia_events').update({ status: 'ready' }).eq('id', eventId)
    router.push(`/host/trivia/${eventId}/teams`)
  }

  const totalFilled = Object.values(questions).flat().filter(
    q => q.question_text.trim() && q.answer_text.trim()
  ).length
  const totalSlots = Object.values(questions).flat().length

  if (loading) return <p className="text-navy/40 text-sm py-12 text-center">Loading…</p>

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
            disabled={totalFilled < totalSlots || totalSlots === 0}
            title={totalFilled < totalSlots ? `${totalFilled}/${totalSlots} questions filled` : 'Mark ready'}
          >
            Mark Ready
          </Button>
        </div>
      </div>

      <p className="text-sm text-navy/50">{totalFilled}/{totalSlots} questions filled</p>

      {showCSV && <CSVImport eventId={eventId} rounds={rounds} onImported={loadData} />}

      {/* Rounds */}
      {rounds.map(round => (
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
                      onChange={e => updateQuestion(round.id, idx, 'points', Number(e.target.value))}
                      className="text-xs border border-timber/30 rounded px-2 py-1 bg-snow-card text-navy"
                    >
                      {[1, 2, 3].map(p => (
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

                {/* Media type selector */}
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={q.media_type}
                      onChange={e => {
                        updateQuestion(round.id, idx, 'media_type', e.target.value as MediaType)
                        // Clear existing media when changing type
                        if (e.target.value === 'none') {
                          updateQuestion(round.id, idx, 'media_url', null)
                          updateQuestion(round.id, idx, 'media_storage_path', null)
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
                        {q.media_type === 'video'
                          ? 'Paste a YouTube URL'
                          : 'Paste a URL or upload a file'}
                      </span>
                    )}
                  </div>

                  <MediaSection
                    q={q}
                    roundId={round.id}
                    idx={idx}
                    eventId={eventId}
                    onUpdate={(field, value) => updateQuestion(round.id, idx, field, value)}
                    onSave={() => saveQuestion(round.id, idx)}
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
