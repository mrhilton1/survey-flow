import type { SurveyQuestion } from "./types"

export interface ThisOrThatMatchup {
  left: string
  right: string
  selected?: string | null
  inferred?: boolean | null
}

export interface ThisOrThatRanking {
  option: string
  rank: number
  wins: number
  matches: number
  winPercentage: number
  totalWins: number
  inferredWins: number
  finalRankValue: number
}

export function shouldUseInferenceAlgorithm(question: SurveyQuestion) {
  return question.type === "this-or-that" && question.useInferenceAlgorithm !== false
}

export function isThisOrThatMatchupArray(value: unknown): value is ThisOrThatMatchup[] {
  return Array.isArray(value) && value.every((item) => (
    typeof item === "object" && item !== null && "left" in item && "right" in item
  ))
}

export function computeThisOrThatRankings({
  question,
  answer,
  options
}: {
  question: SurveyQuestion
  answer: unknown
  options?: string[]
}): ThisOrThatRanking[] {
  const opts = options || question.options || []
  const matchHistory = isThisOrThatMatchupArray(answer) ? answer : []

  if (!shouldUseInferenceAlgorithm(question)) {
    const stats = opts.map((option) => {
      const matches = matchHistory.filter((matchup) => matchup.selected && (matchup.left === option || matchup.right === option)).length
      const wins = matchHistory.filter((matchup) => matchup.selected === option).length
      return {
        option,
        rank: 0,
        wins,
        matches,
        winPercentage: matches > 0 ? wins / matches : 0,
        totalWins: wins,
        inferredWins: 0,
        finalRankValue: wins
      }
    }).sort((a, b) => b.wins - a.wins || b.winPercentage - a.winPercentage || a.option.localeCompare(b.option))

    return stats.map((stat, index) => ({ ...stat, rank: index + 1 }))
  }

  const directWins = new Map<string, Set<string>>()
  opts.forEach((option) => directWins.set(option, new Set()))

  matchHistory.forEach((matchup) => {
    if (!matchup.selected) return
    const winner = matchup.selected
    const loser = matchup.selected === matchup.left ? matchup.right : matchup.left
    directWins.get(winner)?.add(loser)
  })

  const reachable = new Map<string, Set<string>>()
  opts.forEach((option) => reachable.set(option, new Set(directWins.get(option))))

  let changed = true
  while (changed) {
    changed = false
    for (const option of opts) {
      const optionReachable = reachable.get(option)
      if (!optionReachable) continue
      for (const reached of Array.from(optionReachable)) {
        const reachedSet = reachable.get(reached)
        if (!reachedSet) continue
        for (const transitive of Array.from(reachedSet)) {
          if (!optionReachable.has(transitive) && option !== transitive) {
            optionReachable.add(transitive)
            changed = true
          }
        }
      }
    }
  }

  const strictWins = new Map<string, Set<string>>()
  opts.forEach((option) => strictWins.set(option, new Set()))

  opts.forEach((a) => {
    opts.forEach((b) => {
      if (a === b) return
      const aReachesB = reachable.get(a)?.has(b) || false
      const bReachesA = reachable.get(b)?.has(a) || false
      if (aReachesB && !bReachesA) strictWins.get(a)?.add(b)
    })
  })

  const stats = opts.map((option) => {
    const matches = matchHistory.filter((matchup) => matchup.selected && (matchup.left === option || matchup.right === option)).length
    const wins = matchHistory.filter((matchup) => matchup.selected === option).length
    const totalWins = strictWins.get(option)?.size || 0
    return {
      option,
      rank: 0,
      wins,
      matches,
      winPercentage: matches > 0 ? wins / matches : 0,
      totalWins,
      inferredWins: Math.max(0, totalWins - wins),
      higherWinPercentConstant: 1,
      finalRankValue: 0
    }
  })

  const groups: Record<number, typeof stats> = {}
  stats.forEach((stat) => {
    groups[stat.totalWins] = groups[stat.totalWins] || []
    groups[stat.totalWins].push(stat)
  })

  Object.values(groups).forEach((group) => {
    if (group.length <= 1) return
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i]
        const right = group[j]
        if (left.winPercentage > right.winPercentage) {
          left.higherWinPercentConstant = Math.min(10, left.higherWinPercentConstant * 2)
        } else if (right.winPercentage > left.winPercentage) {
          right.higherWinPercentConstant = Math.min(10, right.higherWinPercentConstant * 2)
        } else if (left.option < right.option) {
          left.higherWinPercentConstant = Math.min(10, left.higherWinPercentConstant * 2)
        } else {
          right.higherWinPercentConstant = Math.min(10, right.higherWinPercentConstant * 2)
        }
      }
    }
  })

  const sorted = stats
    .map((stat) => ({
      ...stat,
      finalRankValue: stat.totalWins + Math.pow(2, stat.higherWinPercentConstant)
    }))
    .sort((a, b) => b.finalRankValue - a.finalRankValue || b.winPercentage - a.winPercentage || a.option.localeCompare(b.option))

  return sorted.map(({ higherWinPercentConstant: _, ...stat }, index) => ({ ...stat, rank: index + 1 }))
}
