'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { EventStatus } from '@/lib/types'

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
