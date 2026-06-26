import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default async function KnockoutTournamentsPage() {
  const supabase = await createClient()
  const { data: tournaments } = await supabase
    .from('pool_tournaments')
    .select('id, name, event_date, status')
    .order('event_date', { ascending: false })
    .limit(20)

  const active   = (tournaments ?? []).filter(t => t.status === 'active')
  const setup    = (tournaments ?? []).filter(t => t.status === 'setup')
  const complete = (tournaments ?? []).filter(t => t.status === 'complete')
  const ordered  = [...active, ...setup, ...complete]

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Pool Knockout Tournaments</h1>
        <Link href="/host/pool/knockout/new">
          <Button size="sm">+ New Tournament</Button>
        </Link>
      </div>

      {ordered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-timber/30 rounded-xl">
          <p className="text-navy/40 text-sm mb-3">No knockout tournaments yet.</p>
          <Link href="/host/pool/knockout/new">
            <Button size="sm" variant="secondary">Start Tonight's Draw</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map(t => {
            const date = new Date(t.event_date).toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })
            return (
              <div key={t.id} className="bg-snow-card rounded-xl border border-timber/20 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant={t.status === 'active' ? 'live' : t.status === 'setup' ? 'draft' : 'complete'}>
                    {t.status}
                  </Badge>
                  <div>
                    <p className="font-medium text-navy text-sm">{t.name}</p>
                    <p className="text-navy/40 text-xs">{date}</p>
                  </div>
                </div>
                <Link href={`/host/pool/knockout/${t.id}`}>
                  <Button size="sm" variant={t.status === 'active' ? 'primary' : 'ghost'}>
                    {t.status === 'active' ? 'Manage' : t.status === 'setup' ? 'Setup' : 'View'}
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
