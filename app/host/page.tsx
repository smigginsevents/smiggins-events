import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { TriviaEvent, PoolEvent, EventStatus } from '@/lib/types'

function statusVariant(status: EventStatus | 'live'): 'draft' | 'ready' | 'live' | 'complete' {
  return status as any
}

export default async function HostDashboard() {
  const supabase = await createClient()

  const [{ data: triviaEvents }, { data: poolEvents }] = await Promise.all([
    supabase
      .from('trivia_events')
      .select('*')
      .order('event_date', { ascending: false })
      .limit(10),
    supabase
      .from('pool_events')
      .select('*')
      .order('event_date', { ascending: false })
      .limit(10),
  ])

  const upcomingTrivia = (triviaEvents as TriviaEvent[] ?? []).filter(
    (e) => e.status !== 'complete'
  )
  const pastTrivia = (triviaEvents as TriviaEvent[] ?? []).filter(
    (e) => e.status === 'complete'
  )

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/host/trivia/new">
            <Button variant="secondary" size="sm">+ New Trivia</Button>
          </Link>
          <Link href="/host/pool/knockout/new">
            <Button variant="ghost" size="sm">+ New Pool Knockout</Button>
          </Link>
        </div>
      </div>

      {/* Trivia Events */}
      <section>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Trivia Nights</h2>

        {upcomingTrivia.length === 0 && pastTrivia.length === 0 ? (
          <p className="text-navy/40 text-sm py-8 text-center border border-dashed border-timber/30 rounded-xl">
            No trivia events yet.{' '}
            <Link href="/host/trivia/new" className="text-rust underline underline-offset-2">Create one</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...upcomingTrivia, ...pastTrivia].map((event) => (
              <EventRow key={event.id} event={event} type="trivia" />
            ))}
          </div>
        )}
      </section>

      {/* Pool Knockout Tournaments */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">Pool Knockout</h2>
          <Link href="/host/pool/knockout" className="text-xs text-navy/50 hover:text-navy underline underline-offset-2">View all</Link>
        </div>

        {(poolEvents ?? []).length === 0 ? (
          <p className="text-navy/40 text-sm py-8 text-center border border-dashed border-timber/30 rounded-xl">
            No knockout tournaments yet.{' '}
            <Link href="/host/pool/knockout/new" className="text-rust underline underline-offset-2">Start tonight&apos;s draw</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(poolEvents as PoolEvent[]).map((event) => (
              <PoolEventRow key={event.id} event={event} />
            ))}
            <Link href="/host/pool/knockout" className="text-center text-navy/40 text-xs py-2 hover:text-navy transition-colors">
              View all knockout tournaments →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function EventRow({ event, type }: { event: TriviaEvent; type: 'trivia' }) {
  const date = new Date(event.event_date).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="bg-snow-card rounded-xl border border-timber/20 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
        <div>
          <p className="font-medium text-navy text-sm">{event.name}</p>
          <p className="text-navy/40 text-xs">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {event.status === 'live' && (
          <Link href={`/host/trivia/${event.id}/control`}>
            <Button size="sm" variant="primary">Control</Button>
          </Link>
        )}
        {event.status === 'ready' && (
          <Link href={`/host/trivia/${event.id}/run`}>
            <Button size="sm" variant="secondary">Start Show</Button>
          </Link>
        )}
        {event.status === 'draft' && (
          <Link href={`/host/trivia/${event.id}/questions`}>
            <Button size="sm" variant="ghost">Edit</Button>
          </Link>
        )}
        {event.status === 'complete' && (
          <Link href={`/host/trivia/${event.id}/questions`}>
            <Button size="sm" variant="ghost">View</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

function PoolEventRow({ event }: { event: PoolEvent }) {
  const date = new Date(event.event_date).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="bg-snow-card rounded-xl border border-timber/20 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Badge variant={event.status as any}>{event.status}</Badge>
        <div>
          <p className="font-medium text-navy text-sm">{event.name}</p>
          <p className="text-navy/40 text-xs">{date}</p>
        </div>
      </div>
      <Link href={`/host/pool/${event.id}/scores`}>
        <Button size="sm" variant="ghost">Scores</Button>
      </Link>
    </div>
  )
}
