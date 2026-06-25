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
  points?: string
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

    const toInsert = preview.map((row) => ({
      round_id: roundMap[Number(row.round_number)],
      question_number: Number(row.question_number) || 1,
      question_text: row.question_text,
      answer_text: row.answer_text,
      media_url: row.media_url || null,
      media_type: row.media_url ? 'image' : 'none',
      points: Number(row.points) || 1,
    })).filter((q) => q.round_id)

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
          href="data:text/csv;charset=utf-8,round_number,question_number,question_text,answer_text,media_url,points%0A1,1,Question here,Answer here,,1"
          download="trivia-template.csv"
          className="text-xs text-rust hover:underline"
        >
          Download template
        </a>
      </div>

      <p className="text-xs text-navy/50 mb-4">
        Expected columns: <code className="bg-snow px-1 py-0.5 rounded">round_number, question_number, question_text, answer_text, media_url, points</code>
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
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-timber/10">
                    <td className="px-3 py-2 text-navy/60">{row.round_number}</td>
                    <td className="px-3 py-2 text-navy/60">{row.question_number}</td>
                    <td className="px-3 py-2 text-navy truncate max-w-xs">{row.question_text}</td>
                    <td className="px-3 py-2 text-navy truncate max-w-xs">{row.answer_text}</td>
                  </tr>
                ))}
                {preview.length > 10 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-navy/40 text-center">
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
