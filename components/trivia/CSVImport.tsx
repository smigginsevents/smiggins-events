'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { TriviaRound } from '@/lib/types'

interface CSVRow {
  round_number: string
  question_number: string
  question_text: string
  answer_text: string
  media_url?: string
  media_type?: string
  points?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_option?: string
  host_comment?: string
}

const MEDIA_TYPES = ['none', 'image', 'audio', 'video'] as const

// Explicit media_type column wins; otherwise infer image from a URL.
// A media_type without a URL is valid — the builder shows the upload
// slot so media can be added after import.
function parseMediaType(row: CSVRow): { mediaType: string | null; error: string | null } {
  const raw = (row.media_type ?? '').trim().toLowerCase()
  if (!raw) return { mediaType: null, error: null }
  if (!(MEDIA_TYPES as readonly string[]).includes(raw)) {
    return { mediaType: null, error: `media_type "${row.media_type}" isn't one of ${MEDIA_TYPES.join('/')}` }
  }
  return { mediaType: raw, error: null }
}

// Reads option_a–option_d off a row. 2+ filled options ⇒ multiple choice.
// correct index comes from the correct_option column (A–D or 1–4), falling
// back to a case-insensitive match of answer_text against the options.
function parseMultipleChoice(row: CSVRow): {
  options: string[] | null
  correctIndex: number | null
  error: string | null
} {
  const raw = [row.option_a, row.option_b, row.option_c, row.option_d]
    .map((o) => (o ?? '').trim())
  const options = raw.filter(Boolean)
  if (options.length === 0) return { options: null, correctIndex: null, error: null }
  if (options.length === 1) {
    return { options: null, correctIndex: null, error: 'only 1 option filled — need 2–4 for multiple choice' }
  }

  let correctIndex: number | null = null
  const marker = (row.correct_option ?? '').trim().toUpperCase()
  if (marker) {
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(marker)
    const numIdx = /^[1-4]$/.test(marker) ? Number(marker) - 1 : -1
    const rawIdx = letterIdx >= 0 ? letterIdx : numIdx
    if (rawIdx < 0 || !raw[rawIdx]) {
      return { options, correctIndex: null, error: `correct_option "${row.correct_option}" doesn't point at a filled option` }
    }
    // index within the compacted list (in case a middle option was left blank)
    correctIndex = raw.slice(0, rawIdx).filter(Boolean).length
  } else {
    const answer = (row.answer_text ?? '').trim().toLowerCase()
    correctIndex = options.findIndex((o) => o.toLowerCase() === answer)
    if (correctIndex < 0) {
      return { options, correctIndex: null, error: 'set correct_option to A/B/C/D, or make answer_text exactly match one option' }
    }
  }
  return { options, correctIndex, error: null }
}

interface Props {
  eventId: string
  rounds: TriviaRound[]
  onImported: () => void
}

export function CSVImport({ eventId, rounds, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CSVRow[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errs: string[] = []
        result.data.forEach((row, i) => {
          if (!row.round_number) errs.push(`Row ${i + 1}: missing round_number`)
          if (!row.question_text) errs.push(`Row ${i + 1}: missing question_text`)
          if (!row.answer_text) errs.push(`Row ${i + 1}: missing answer_text`)
          const mc = parseMultipleChoice(row)
          if (mc.error) errs.push(`Row ${i + 1}: ${mc.error}`)
          const media = parseMediaType(row)
          if (media.error) errs.push(`Row ${i + 1}: ${media.error}`)
        })
        setErrors(errs)
        setPreview(result.data)
      },
    })
  }

  async function commitImport() {
    if (!preview || errors.length > 0) return
    setImporting(true)

    const supabase = createClient()

    // Delete existing questions for this event
    const roundIds = rounds.map((r) => r.id)
    await supabase.from('trivia_questions').delete().in('round_id', roundIds)

    // Map round_number → round id
    const roundMap: Record<number, string> = {}
    rounds.forEach((r) => { roundMap[r.round_number] = r.id })

    const toInsert = preview.map((row) => {
      const mc = parseMultipleChoice(row)
      return {
        round_id: roundMap[Number(row.round_number)],
        question_number: Number(row.question_number) || 1,
        question_text: row.question_text,
        answer_text: row.answer_text,
        media_url: row.media_url || null,
        media_type: parseMediaType(row).mediaType ?? (row.media_url ? 'image' : 'none'),
        points: Number(row.points) || 1,
        multiple_choice_options: mc.options,
        correct_option_index: mc.correctIndex,
        host_comment: row.host_comment?.trim() || null,
      }
    }).filter((q) => q.round_id)

    await supabase.from('trivia_questions').insert(toInsert)

    setPreview(null)
    setImporting(false)
    onImported()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">Import from CSV</h2>
        <a
          href={'data:text/csv;charset=utf-8,' + encodeURIComponent(
            'round_number,question_number,question_text,answer_text,media_url,media_type,points,option_a,option_b,option_c,option_d,correct_option,host_comment\n' +
            '1,1,Open question here,Answer here,,,1,,,,,,Bonus knowledge for the host to drop after the reveal\n' +
            '1,2,Multiple choice question here,Option B text,,,1,Option A text,Option B text,Option C text,Option D text,B,Bonus knowledge for the host\n' +
            '1,3,TRUE or FALSE: statement here,FALSE,,,1,True,False,,,B,Bonus knowledge for the host\n' +
            '1,4,Media question here (add the file or URL after import),Answer here,,audio,1,,,,,,Bonus knowledge for the host\n'
          )}
          download="trivia-template.csv"
          className="text-xs text-rust hover:underline"
        >
          Download template
        </a>
      </div>

      <p className="text-xs text-navy/50 mb-2">
        Expected columns: <code className="bg-snow px-1 py-0.5 rounded">round_number, question_number, question_text, answer_text, media_url, media_type, points, option_a, option_b, option_c, option_d, correct_option, host_comment</code>
      </p>
      <p className="text-xs text-navy/50 mb-2">
        <code className="bg-snow px-1 py-0.5 rounded">host_comment</code> is optional bonus knowledge only you see — it shows up on the Control page while you&apos;re marking, and never reaches the display screen or players.
      </p>
      <p className="text-xs text-navy/50 mb-2">
        Fill in 2–4 of <code className="bg-snow px-1 py-0.5 rounded">option_a</code>–<code className="bg-snow px-1 py-0.5 rounded">option_d</code> to make a question multiple choice — it&apos;s detected automatically. True/false is just multiple choice with options <code className="bg-snow px-1 py-0.5 rounded">True</code> and <code className="bg-snow px-1 py-0.5 rounded">False</code>. Mark the right answer with <code className="bg-snow px-1 py-0.5 rounded">correct_option</code> (A–D), or leave it blank if <code className="bg-snow px-1 py-0.5 rounded">answer_text</code> exactly matches one of the options.
      </p>
      <p className="text-xs text-navy/50 mb-4">
        For media questions, set <code className="bg-snow px-1 py-0.5 rounded">media_type</code> to <code className="bg-snow px-1 py-0.5 rounded">image</code>, <code className="bg-snow px-1 py-0.5 rounded">audio</code> or <code className="bg-snow px-1 py-0.5 rounded">video</code>. You can leave <code className="bg-snow px-1 py-0.5 rounded">media_url</code> blank and upload the file (or paste a URL) here after importing.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
      />

      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
        Choose CSV file
      </Button>

      {errors.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-600 mb-2">Validation errors</p>
          <ul className="text-xs text-red-500 list-disc list-inside">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {preview && errors.length === 0 && (
        <div className="mt-4">
          <p className="text-sm text-navy/60 mb-3">
            {preview.length} questions ready to import. This will replace all current questions.
          </p>
          <div className="bg-snow rounded-lg overflow-auto max-h-48 mb-4">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-timber/20">
                  <th className="text-left px-3 py-2 text-timber">R</th>
                  <th className="text-left px-3 py-2 text-timber">Q</th>
                  <th className="text-left px-3 py-2 text-timber">Question</th>
                  <th className="text-left px-3 py-2 text-timber">Answer</th>
                  <th className="text-left px-3 py-2 text-timber">Type</th>
                  <th className="text-left px-3 py-2 text-timber">Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => {
                  const mc = parseMultipleChoice(row)
                  const mediaType = parseMediaType(row).mediaType ?? (row.media_url ? 'image' : 'none')
                  const isTrueFalse = mc.options?.length === 2 &&
                    mc.options.every((o) => ['true', 'false'].includes(o.toLowerCase()))
                  return (
                    <tr key={i} className="border-b border-timber/10">
                      <td className="px-3 py-2 text-navy/60">{row.round_number}</td>
                      <td className="px-3 py-2 text-navy/60">{row.question_number}</td>
                      <td className="px-3 py-2 text-navy truncate max-w-xs">{row.question_text}</td>
                      <td className="px-3 py-2 text-navy truncate max-w-xs">{row.answer_text}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isTrueFalse ? (
                          <span className="text-rust font-medium">
                            T/F ✓{(mc.correctIndex ?? 0) === 0 ? 'True' : 'False'}
                          </span>
                        ) : mc.options ? (
                          <span className="text-rust font-medium">
                            MC ({mc.options.length}) ✓{['A', 'B', 'C', 'D'][mc.correctIndex ?? 0]}
                          </span>
                        ) : (
                          <span className="text-navy/40">Open</span>
                        )}
                        {mediaType !== 'none' && (
                          <span className="ml-1 text-navy/60">
                            {mediaType === 'audio' ? '🎵' : mediaType === 'video' ? '▶' : '🖼️'}
                            {!row.media_url && ' (add media)'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-navy/40">
                        {row.host_comment?.trim() ? '📝' : ''}
                      </td>
                    </tr>
                  )
                })}
                {preview.length > 10 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-navy/40 text-center">
                      …and {preview.length - 10} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button onClick={commitImport} loading={importing} variant="primary">
            Import {preview.length} Questions
          </Button>
        </div>
      )}
    </Card>
  )
}
