// TypeScript types mirroring the Supabase database schema

export type EventStatus = 'draft' | 'ready' | 'live' | 'complete'
export type LivePhase =
  | 'lobby'
  | 'round_intro'
  | 'question'
  | 'timer_running'
  | 'answer_reveal'
  | 'round_leaderboard'
  | 'final_reveal'
  | 'complete'
export type MediaType = 'none' | 'image' | 'video' | 'audio'

export interface Team {
  id: string
  name: string
  created_at: string
}

// ─── Trivia ──────────────────────────────────────────────────────────────────

export interface TriviaEvent {
  id: string
  name: string
  event_date: string
  status: EventStatus
  default_time_limit_seconds: number
  created_at: string
}

export interface TriviaRound {
  id: string
  event_id: string
  round_number: number
  name: string
  time_limit_seconds: number | null
}

export interface TriviaQuestion {
  id: string
  round_id: string
  question_number: number
  question_text: string
  answer_text: string
  media_type: MediaType
  media_url: string | null
  media_storage_path: string | null
  points: number
}

/** Safe version — answer_text omitted — for the public display screen */
export type TriviaQuestionPublic = Omit<TriviaQuestion, 'answer_text'>

export interface TriviaEventTeam {
  id: string
  event_id: string
  team_id: string
  team?: Team
}

export interface TriviaScore {
  id: string
  event_id: string
  round_id: string
  team_id: string
  points: number
}

export interface TriviaLiveState {
  event_id: string
  current_round_id: string | null
  current_question_id: string | null
  phase: LivePhase
  timer_started_at: string | null
  leaderboard_revealed: boolean
  updated_at: string
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

export interface PoolEvent {
  id: string
  name: string
  event_date: string
  status: 'draft' | 'live' | 'complete'
}

export interface PoolScore {
  id: string
  event_id: string
  team_id: string
  points: number
}

// ─── Pool Knockout ─────────────────────────────────────────────────────────────

export interface PoolPlayer {
  id: string
  name: string
  created_at: string
}

export interface PoolTournament {
  id: string
  name: string
  event_date: string
  status: 'setup' | 'active' | 'complete'
  silver_winner_id: string | null
  created_at: string
}

export interface PoolTournamentEntry {
  id: string
  tournament_id: string
  player_id: string
  draw_order: number | null
}

export type MatchStatus = 'pending' | 'active' | 'complete'

export interface PoolMatch {
  id: string
  tournament_id: string
  round_number: number
  match_number: number
  table_number: 1 | 2
  player1_id: string | null
  player2_id: string | null
  is_bye: boolean
  is_silver_match: boolean
  winner_id: string | null
  status: MatchStatus
  created_at: string
}

// ─── Leaderboard aggregates ───────────────────────────────────────────────────

export interface LeaderboardEntry {
  team_id: string
  team_name: string
  total_points: number
  rank: number
}
