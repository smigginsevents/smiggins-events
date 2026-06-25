'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TriviaLiveState } from '@/lib/types'

/**
 * Subscribe to real-time changes on the trivia_live_state row for a given event.
 * Both the control panel and the display screen use this hook.
 */
export function useLiveState(
  eventId: string,
  onUpdate: (state: TriviaLiveState) => void
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`live-state-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trivia_live_state',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          onUpdateRef.current(payload.new as TriviaLiveState)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])
}

/** Write a new phase + optional fields to trivia_live_state */
export async function updateLiveState(
  eventId: string,
  patch: Partial<Omit<TriviaLiveState, 'event_id'>>
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('trivia_live_state')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)

  if (error) throw error
}
