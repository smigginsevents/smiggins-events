'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { duplicateTriviaEvent } from '@/lib/duplicateTriviaEvent'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { EventStatus } from '@/lib/types'

function nextTuesday(): string {
  const d = new Date()
  const diff = (2 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

interface Props {
  id: string
  name: string
  eventDate: string
  status: EventStatus
}

function statusVariant(s: EventStatus) { return s }

export function TriviaEventRow({ id, name, eventDate, status }: Props) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateDate, setDuplicateDate] = useState(nextTuesday)

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const newId = await duplicateTriviaEvent(id, duplicateDate)
      router.push(`/host/trivia/${newId}/questions`)
    } catch (e: any) {
      alert('Duplicate failed: ' + e.message)
      setDuplicating(false)
      setConfirmDuplicate(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const supabase = createClient()
      await Promise.all([
        supabase.from('trivia_scores').delete().eq('event_id', id),
        supabase.from('trivia_event_teams').delete().eq('event_id', id),
        supabase.from('trivia_events').update({ status: 'ready' }).eq('id', id),
      ])
      await supabase.from('trivia_live_state').update({
        phase: 'lobby',
        current_round_id: null,
        current_question_id: null,
        timer_started_at: null,
        leaderboard_revealed: false,
        marking_question_index: 0,
        marking_revealed: false,
        updated_at: new Date().toISOString(),
      }).eq('event_id', id)
      router.refresh()
    } catch (e: any) {
      alert('Reset failed: ' + e.message)
    } finally {
      setResetting(false)
      setConfirmReset(false)
    }
  }

  const date = new Date(eventDate).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()

      // Clean up any storage files attached to questions in this event
      const { data: rounds } = await supabase
        .from('trivia_rounds').select('id').eq('event_id', id)
      const roundIds = (rounds ?? []).map(r => r.id)

      if (roundIds.length > 0) {
        const { data: questions } = await supabase
          .from('trivia_questions')
          .select('media_storage_path')
          .in('round_id', roundIds)
          .not('media_storage_path', 'is', null)

        const paths = (questions ?? [])
          .map(q => q.media_storage_path)
          .filter(Boolean) as string[]

        if (paths.length > 0) {
          await supabase.storage.from('trivia-media').remove(paths)
        }
      }

      // Delete event — cascades to rounds, questions, event_teams, scores, live_state
      const { error } = await supabase.from('trivia_events').delete().eq('id', id)
      if (error) throw new Error(error.message)

      router.refresh()
    } catch (e: any) {
      alert('Delete failed: ' + e.message)
      setDeleting(false)
      setConfirm(false)
    }
  }

  return (
    <div className="bg-snow-card rounded-xl border border-timber/20 px-5 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-4 min-w-0">
        <Badge variant={statusVariant(status)}>{status}</Badge>
        <div className="min-w-0">
          <p className="font-medium text-navy text-sm truncate">{name}</p>
          <p className="text-navy/40 text-xs">{date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Action button based on status */}
        {status === 'live' && (
          <Link href={`/host/trivia/${id}/control`}>
            <Button size="sm" variant="primary">Control</Button>
          </Link>
        )}
        {status === 'ready' && (
          <Link href={`/host/trivia/${id}/run`}>
            <Button size="sm" variant="secondary">Start Show</Button>
          </Link>
        )}
        {(status === 'draft' || status === 'complete') && (
          <Link href={`/host/trivia/${id}/questions`}>
            <Button size="sm" variant="ghost">{status === 'draft' ? 'Edit' : 'View'}</Button>
          </Link>
        )}

        {/* Duplicate with inline date picker */}
        {confirmDuplicate ? (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-blue-700 font-medium whitespace-nowrap">Copy to:</span>
            <input
              type="date"
              value={duplicateDate}
              onChange={e => setDuplicateDate(e.target.value)}
              disabled={duplicating}
              className="text-xs text-blue-900 bg-white border border-blue-200 rounded px-1.5 py-0.5"
            />
            <button
              onClick={handleDuplicate}
              disabled={duplicating || !duplicateDate}
              className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded px-2 py-0.5 transition-colors disabled:opacity-60"
            >
              {duplicating ? '…' : 'Duplicate'}
            </button>
            <button
              onClick={() => setConfirmDuplicate(false)}
              disabled={duplicating}
              className="text-xs text-blue-400 hover:text-blue-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDuplicate(true)}
            title="Duplicate event — copies all rounds, questions and media into a new draft"
            className="text-xs text-navy/25 hover:text-blue-500 transition-colors px-1.5 py-1 rounded"
          >
            ⧉
          </button>
        )}

        {/* Reset with inline confirmation */}
        {confirmReset ? (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
              Clear scores &amp; teams?
            </span>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded px-2 py-0.5 transition-colors disabled:opacity-60"
            >
              {resetting ? '…' : 'Reset'}
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              disabled={resetting}
              className="text-xs text-amber-400 hover:text-amber-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            title="Reset event — clears scores and teams, keeps questions"
            className="text-xs text-navy/25 hover:text-amber-500 transition-colors px-1.5 py-1 rounded"
          >
            ↺
          </button>
        )}

        {/* Delete with inline confirmation */}
        {confirm ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-red-700 font-medium whitespace-nowrap">
              Delete all data?
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded px-2 py-0.5 transition-colors disabled:opacity-60"
            >
              {deleting ? '…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            title="Delete event"
            className="w-7 h-7 flex items-center justify-center rounded-full text-navy/25 hover:text-red-500 hover:bg-red-50 transition-colors text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
