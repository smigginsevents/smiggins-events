// Medal resolution for pool knockout tournaments

export interface PlayerRef {
  id: string
  name: string
}

export interface MatchForMedals {
  roundNumber: number
  isBye: boolean
  isSilverMatch?: boolean
  status: string
  player1: PlayerRef | null
  player2: PlayerRef | null
  winner: PlayerRef | null
}

export interface MedalState {
  gold: PlayerRef | null
  silver: PlayerRef | null
  needsPlayoff: boolean
  playoffPlayers: [PlayerRef, PlayerRef] | null
}

function matchLoser(m: MatchForMedals): PlayerRef | null {
  if (!m.winner || m.isBye || !m.player1 || !m.player2) return null
  if (m.winner.id === m.player1.id) return m.player2
  if (m.winner.id === m.player2.id) return m.player1
  return null
}

export function getBracketMatches<T extends MatchForMedals>(matches: T[]): T[] {
  return matches.filter(m => !m.isSilverMatch)
}

export function getSilverMatch<T extends MatchForMedals>(matches: T[]): T | null {
  return matches.find(m => m.isSilverMatch) ?? null
}

export function getFinalMatch<T extends MatchForMedals>(matches: T[]): T | null {
  const bracket = getBracketMatches(matches)
  if (bracket.length === 0) return null
  const maxRound = Math.max(...bracket.map(m => m.roundNumber))
  const finals = bracket.filter(
    m => m.roundNumber === maxRound && !m.isBye && m.player1 && m.player2,
  )
  if (finals.length !== 1) return null
  return finals[0]
}

/** Resolve gold/silver from bracket state. */
export function resolveMedals(
  matches: MatchForMedals[],
  storedSilverWinner: PlayerRef | null,
): MedalState {
  const empty: MedalState = { gold: null, silver: null, needsPlayoff: false, playoffPlayers: null }

  const silverMatch = getSilverMatch(matches)
  if (silverMatch?.winner) {
    const final = getFinalMatch(matches)
    return {
      gold: final?.winner ?? null,
      silver: silverMatch.winner,
      needsPlayoff: false,
      playoffPlayers: null,
    }
  }

  if (storedSilverWinner) {
    const final = getFinalMatch(matches)
    return {
      gold: final?.winner ?? null,
      silver: storedSilverWinner,
      needsPlayoff: false,
      playoffPlayers: null,
    }
  }

  const final = getFinalMatch(matches)
  if (!final?.winner) return empty

  const gold = final.winner
  const finalLoser = matchLoser(final)
  const bracket = getBracketMatches(matches)
  const maxRound = Math.max(...bracket.map(m => m.roundNumber))
  const semiRound = maxRound - 1
  if (semiRound < 1) {
    const silver = finalLoser && finalLoser.id !== gold.id ? finalLoser : null
    return { gold, silver, needsPlayoff: false, playoffPlayers: null }
  }

  const semiMatches = bracket.filter(m => m.roundNumber === semiRound)
  const semiByes = semiMatches.filter(m => m.isBye)
  const semiPlayed = semiMatches.filter(
    m => !m.isBye && m.player1 && m.player2 && m.winner,
  )

  // 3 semifinalists: one real semi + one bye → silver must be decided by playoff
  if (semiByes.length > 0 && semiPlayed.length === 1) {
    const semiLoser = matchLoser(semiPlayed[0])
    if (semiLoser && finalLoser && semiLoser.id !== finalLoser.id) {
      return {
        gold,
        silver: null,
        needsPlayoff: true,
        playoffPlayers: [semiLoser, finalLoser],
      }
    }
  }

  const silver = finalLoser && finalLoser.id !== gold.id ? finalLoser : null
  return { gold, silver, needsPlayoff: false, playoffPlayers: null }
}
