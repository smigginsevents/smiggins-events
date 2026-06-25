'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PoolEvent, Team } from '@/lib/types'

interface ScoreRow {
  team_id: string
  team_name: string
  points: number
}

export default function PoolScoresPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [event, setEvent] = useState<PoolEvent | null>(null)
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: evt }, { data: sc }, { data: teams }] = await Promise.all([
      supabase.from('pool_events').select('*').eq('id', eventId).single(),
      supabase.from('pool_scores').select('team_id, points, teams(name)').eq('event_id', eventId),
      supabase.from('teams').select('*').order('name'),
    ])
    setEvent(evt)
    setAllTeams(teams ?? [])
    setScores(
      (sc ?? []).map((s: any) => ({
        team_id: s.team_id,
        team_name: s.teams?.name ?? 'Unknown',
        points: s.points,
      }))
    )
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadData() }, [loadData])

  const registeredIds = new Set(scores.map((s) => s.team_id))
  const suggestions = allTeams.filter(
    (t) => !registeredIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function addTeam(team: Team) {
    const supabase = createClient()
    await supabase.from('pool_scores').insert({ event_id: eventId, team_id: team.id, points: 0 })
    setSearch('')
    await loadData()
  }

  async function createAndAdd() {
    const name = search.trim()
    if (!name) return
    const supabase = createClient()
    const { data: team } = await supabase.from('teams').insert({ name }).select('*').single()
    if (team) await addTeam(team)
  }

  function updateScore(teamId: string, points: number) {
    setScores((prev) =>
      prev.map((s) => s.team_id === teamId ? { ...s, points } : s)
    )
  }

  async function saveScores() {
    setSaving(true)
    const supabase = createClient()
    await Promise.all(
      scores.map((s) =>
        supabase.from('pool_scores')
          .upsert({ event_id: eventId, team_id: s.team_id, points: s.points }, { onConflict: 'event_id,team_id' })
      )
    )
    setSaving(false)
  }

  async function markComplete() {
    await saveScores()
    const supabase = createClient()
    await supabase.from('pool_events').update({ status: 'complete' }).eq('id', eventId)
    router.push('/host')
  }

  if (loading) return <p className="text-navy/40 text-sm py-12 text-center">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/host" className="text-timber text-sm hover:text-navy">← Dashboard</Link>
          <h1 className="text-2xl font-semibold text-navy mt-1">{event?.name}</h1>
          <p className="text-navy/50 text-sm">
            {event && new Date(event.event_date).toLocaleDateString('en-AU', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={saveScores} loading={saving}>Save</Button>
          <Button size="sm" onClick={markComplete}>Mark Complete</Button>
        </div>
      </div>

      {/* Score entry */}
      <Card padded={false}>
        <div className="px-6 py-4 border-b border-timber/10">
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">Scores</h2>
        </div>
        {scores.length === 0 ? (
          <p className="text-navy/40 text-sm text-center py-8">No teams yet. Add them below.</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-timber/10">
              {scores
                .sort((a, b) => b.points - a.points)
                .map((s) => (
                  <tr key={s.team_id} className="px-6">
                    <td className="px-6 py-3 font-medium text-navy text-sm">{s.team_name}</td>
                    <td className="px-6 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={s.points}
                        onChange={(e) => updateScore(s.team_id, Number(e.target.value))}
                        className="w-20 text-right border border-timber/30 rounded px-2 py-1 text-sm text-navy bg-snow-card focus:outline-none focus:ring-2 focus:ring-rust"
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add team */}
      <Card>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Add Team</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search or create team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-timber/40 px-3 py-2 text-sm text-navy bg-snow-card focus:outline-none focus:ring-2 focus:ring-rust"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={createAndAdd}
            disabled={!search.trim() || suggestions.some((t) => t.name.toLowerCase() === search.toLowerCase())}
          >
            Create New
          </Button>
        </div>
        {search && suggestions.length > 0 && (
          <ul className="mt-2 border border-timber/20 rounded-lg overflow-hidden">
            {suggestions.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => addTeam(t)}
                  className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-snow transition-colors"
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
