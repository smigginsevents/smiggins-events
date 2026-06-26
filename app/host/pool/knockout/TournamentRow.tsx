'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Props {
  id: string
  name: string
  eventDate: string
  status: string
}

export function TournamentRow({ id, name, eventDate, status }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const date = new Date(eventDate).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      // Cascades delete entries + matches via ON DELETE CASCADE
      const { error } = await supabase.from('pool_tournaments').delete().eq('id', id)
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
        <Badge variant={status === 'active' ? 'live' : status === 'setup' ? 'draft' : 'complete'}>
          {status}
        </Badge>
        <div className="min-w-0">
          <p className="font-medium text-navy text-sm truncate">{name}</p>
          <p className="text-navy/40 text-xs">{date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={`/host/pool/knockout/${id}`}>
          <Button size="sm" variant={status === 'active' ? 'primary' : 'ghost'}>
            {status === 'active' ? 'Manage' : status === 'setup' ? 'Setup' : 'View'}
          </Button>
        </Link>

        {/* Delete — shows confirm inline before firing */}
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
            title="Delete tournament"
            className="w-7 h-7 flex items-center justify-center rounded-full text-navy/25 hover:text-red-500 hover:bg-red-50 transition-colors text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
