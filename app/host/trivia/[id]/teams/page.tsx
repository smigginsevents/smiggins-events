'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import type { Team } from '@/lib/types'

export default function TriviaTeamsPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()

  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [eventTeams, setEventTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const [{ data: all }, { data: etRows }] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('trivia_event_teams')
        .select('team_id, teams(id,name,created_at)')
        .eq('event_id', eventId),
    ])
    setAllTeams(all ?? [])
    setEventTeams((etRows ?? []).map((r: any) => r.teams).filter(Boolean))
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadTeams() }, [loadTeams])

  const registeredIds = new Set(eventTeams.map((t) => t.id))

  const suggestions = allTeams.filter(
    (t) =>
      !registeredIds.has(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function addTeam(team: Team) {
    const supabase = createClient()
    await supabase.from('trivia_event_teams').insert({
      event_id: eventId,
      team_id: team.id,
    })
    await loadTeams()
    setSearch('')
  }

  async function createAndAddTeam() {
    const name = newTeamName.trim()
    if (!name) return

    // Fuzzy near-match warning
    const near = allTeams.filter((t) =>
      t.name.toLowerCase().includes(name.toLowerCase().slice(0, 5)) ||
      name.toLowerCase().includes(t.name.toLowerCase().slice(0, 5))
    )
    if (near.length > 0) {
      const msg = `Did you mean: ${near.map((t) => t.name).join(', ')}?\nPress OK to create "${name}" anyway.`
      if (!confirm(msg)) return
    }

    const supabase = createClient()
    const { data: team } = await supabase
      .from('teams')
      .insert({ name })
      .select('*')
      .single()

    if (team) {
      await addTeam(team)
      setNewTeamName('')
    }
  }

  async function removeTeam(teamId: string) {
    const supabase = createClient()
    await supabase.from('trivia_event_teams')
      .delete()
      .eq('event_id', eventId)
      .eq('team_id', teamId)
    await loadTeams()
  }

  if (loading) return <p className="text-navy/40 text-sm py-12 text-center">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/host/trivia/${eventId}/questions`} className="text-timber text-sm hover:text-navy">
            ← Questions
          </Link>
          <h1 className="text-2xl font-semibold text-navy mt-1">Tonight's Teams</h1>
        </div>
        <Link href={`/host/trivia/${eventId}/run`}>
          <Button>Next: Pre-Show →</Button>
        </Link>
      </div>

      {/* Registered teams */}
      <Card padded={false}>
        <div className="px-6 py-4 border-b border-timber/10">
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">
            Registered ({eventTeams.length})
          </h2>
        </div>
        {eventTeams.length === 0 ? (
          <p className="text-navy/40 text-sm text-center py-8">No teams added yet.</p>
        ) : (
          <ul className="divide-y divide-timber/10">
            {eventTeams.map((team) => (
              <li key={team.id} className="px-6 py-3 flex items-center justify-between">
                <span className="font-medium text-navy">{team.name}</span>
                <button
                  onClick={() => removeTeam(team.id)}
                  className="text-navy/30 hover:text-red-500 transition-colors text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Add existing team */}
      <Card>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Add Existing Team</h2>
        <Input
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <ul className="mt-2 bg-snow-card border border-timber/20 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-navy/40">No matches</li>
            ) : (
              suggestions.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => addTeam(t)}
                    className="w-full text-left px-4 py-3 text-sm text-navy hover:bg-snow transition-colors"
                  >
                    {t.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </Card>

      {/* Create new team */}
      <Card>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Create New Team</h2>
        <div className="flex gap-3">
          <Input
            placeholder="New team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAndAddTeam()}
            className="flex-1"
          />
          <Button onClick={createAndAddTeam} disabled={!newTeamName.trim()}>
            Add
          </Button>
        </div>
      </Card>
    </div>
  )
}
