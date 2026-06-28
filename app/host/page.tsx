import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { TriviaEventRow } from './TriviaEventRow'
import { TournamentRow } from './pool/knockout/TournamentRow'
import type { TriviaEvent } from '@/lib/types'

export default async function HostDashboard() {
  const supabase = await createClient()

  const [{ data: triviaEvents }, { data: tournaments }] = await Promise.all([
    supabase
      .from('trivia_events')
      .select('*')
      .order('event_date', { ascending: false })
      .limit(10),
    supabase
      .from('pool_tournaments')
      .select('id, name, event_date, status')
      .order('event_date', { ascending: false })
      .limit(5),
  ])

  const allTrivia = triviaEvents as TriviaEvent[] ?? []
  const upcomingTrivia = allTrivia.filter(e => e.status !== 'complete')
  const pastTrivia     = allTrivia.filter(e => e.status === 'complete')

  const active   = (tournaments ?? []).filter(t => t.status === 'active')
  const setup    = (tournaments ?? []).filter(t => t.status === 'setup')
  const complete = (tournaments ?? []).filter(t => t.status === 'complete')
  const orderedTournaments = [...active, ...setup, ...complete]

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

      {/* Trivia Nights */}
      <section>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Trivia Nights</h2>

        {allTrivia.length === 0 ? (
          <p className="text-navy/40 text-sm py-8 text-center border border-dashed border-timber/30 rounded-xl">
            No trivia events yet.{' '}
            <Link href="/host/trivia/new" className="text-rust underline underline-offset-2">Create one</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...upcomingTrivia, ...pastTrivia].map(event => (
              <TriviaEventRow
                key={event.id}
                id={event.id}
                name={event.name}
                eventDate={event.event_date}
                status={event.status}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pool Knockout */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">Pool Knockout</h2>
          <Link href="/host/pool/knockout" className="text-xs text-navy/50 hover:text-navy underline underline-offset-2">View all</Link>
        </div>

        {orderedTournaments.length === 0 ? (
          <p className="text-navy/40 text-sm py-8 text-center border border-dashed border-timber/30 rounded-xl">
            No knockout tournaments yet.{' '}
            <Link href="/host/pool/knockout/new" className="text-rust underline underline-offset-2">Start tonight&apos;s draw</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {orderedTournaments.map(t => (
              <TournamentRow
                key={t.id}
                id={t.id}
                name={t.name}
                eventDate={t.event_date}
                status={t.status}
              />
            ))}
            <Link href="/host/pool/knockout" className="text-center text-navy/40 text-xs py-2 hover:text-navy transition-colors">
              View all tournaments →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
