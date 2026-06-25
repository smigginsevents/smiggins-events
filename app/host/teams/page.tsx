'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import type { Team } from '@/lib/types'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, startSaving] = useTransition()

  async function loadTeams() {
    const supabase = createClient()
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('name')
    setTeams(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTeams() }, [])

  async function createTeam() {
    if (!newName.trim()) return
    startSaving(async () => {
      const supabase = createClient()
      await supabase.from('teams').insert({ name: newName.trim() })
      setNewName('')
      await loadTeams()
    })
  }

  async function renameTeam(id: string) {
    if (!editName.trim()) return
    startSaving(async () => {
      const supabase = createClient()
      await supabase.from('teams').update({ name: editName.trim() }).eq('id', id)
      setEditingId(null)
      await loadTeams()
    })
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('teams').delete().eq('id', id)
    await loadTeams()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-navy">Team Registry</h1>

      {/* Create */}
      <Card>
        <h2 className="text-sm font-semibold text-timber uppercase tracking-wider mb-4">Add New Team</h2>
        <div className="flex gap-3">
          <Input
            placeholder="Team name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTeam()}
            className="flex-1"
          />
          <Button onClick={createTeam} loading={saving} disabled={!newName.trim()}>
            Add Team
          </Button>
        </div>
      </Card>

      {/* List */}
      <Card padded={false}>
        <div className="px-6 py-4 border-b border-timber/10">
          <h2 className="text-sm font-semibold text-timber uppercase tracking-wider">
            All Teams ({teams.length})
          </h2>
        </div>
        {loading ? (
          <p className="text-navy/40 text-sm text-center py-12">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="text-navy/40 text-sm text-center py-12">No teams yet.</p>
        ) : (
          <ul className="divide-y divide-timber/10">
            {teams.map((team) => (
              <li key={team.id} className="px-6 py-3 flex items-center justify-between gap-4">
                {editingId === team.id ? (
                  <div className="flex gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameTeam(team.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => renameTeam(team.id)} loading={saving}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-navy font-medium">{team.name}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(team.id); setEditName(team.name) }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deleteTeam(team.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
