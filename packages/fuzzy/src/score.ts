import { Option } from 'effect'
import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'

/**
 * Score a needle against a haystack. Returns `Option.some(score)` when the
 * needle's characters exist in the haystack (multiset containment passes),
 * or `Option.none()` when characters are missing.
 *
 * Tries the subsequence path first (optimal DP alignment). If the needle
 * is not a subsequence, falls back to the assignment path (greedy with repair).
 *
 * Data-first form: `score(needle, haystack)`
 * Data-last form: `score(needle)` returns `(haystack) => Option<number>`
 */
export function score(needle: string, haystack: string): Option.Option<number>
export function score(needle: string): (haystack: string) => Option.Option<number>
export function score(needle: string, haystack?: string): Option.Option<number> | ((haystack: string) => Option.Option<number>) {
  if (haystack === undefined) return (h: string) => scoreImpl(needle, h)
  return scoreImpl(needle, haystack)
}

const scoreImpl = (needle: string, haystack: string): Option.Option<number> => {
  if (needle.length === 0) return Option.some(0)

  // Token match: if the needle contains spaces, try matching each term
  // independently against the haystack. Terms can match in any order.
  // A reorder penalty applies when terms don't match in needle order.
  if (needle.includes(' ')) {
    const tokenScore = scoreTokenMatch(needle, haystack)
    if (tokenScore !== null) return Option.some(tokenScore)
    // If token matching fails (some term not found), fall through to
    // character-level matching below.
  }

  if (!hasMatch(needle, haystack)) return Option.none()

  // Try subsequence path first — optimal DP alignment
  const subseq = subsequenceScore(needle, haystack)
  if (subseq !== null) return Option.some(subseq.score)

  // Fall back to assignment path — greedy with repair
  const assignment = assignmentScore(needle, haystack)
  if (assignment !== null) return Option.some(assignment.score)

  // Shouldn't reach here if hasMatch passed, but safety
  return Option.none()
}

/**
 * Token-level matching: split needle on spaces, match each term as a
 * subsequence against the haystack independently. Terms can match in
 * any order. A reorder penalty applies when the match order differs
 * from the needle order.
 */
const scoreTokenMatch = (needle: string, haystack: string): number | null => {
  const terms = needle.split(' ').filter((t) => t.length > 0)
  if (terms.length === 0) return 0

  const haystackLower = haystack.toLowerCase()
  const matchPositions: number[] = [] // first match position of each term
  const termScores: number[] = []

  for (const term of terms) {
    // Try subsequence match of term against full haystack
    const subseq = subsequenceScore(term, haystack)
    if (subseq !== null) {
      termScores.push(subseq.score)
      matchPositions.push(subseq.positions[0] ?? 0)
    } else {
      // Term doesn't match as subsequence — try containment
      const termLower = term.toLowerCase()
      if (!haystackLower.includes(termLower)) return null // term not found
      termScores.push(ScoreMatch * term.length) // base score for containment
      matchPositions.push(haystackLower.indexOf(termLower))
    }
  }

  // Sum term scores
  let total = termScores.reduce((a, b) => a + b, 0)

  // Reorder penalty: check if match positions are monotonically increasing
  let inOrder = true
  for (let i = 1; i < matchPositions.length; i++) {
    if (matchPositions[i]! <= matchPositions[i - 1]!) {
      inOrder = false
      break
    }
  }
  if (!inOrder) {
    total -= 5 // reorder penalty
  }

  return total
}

import { ScoreMatch } from './constants.js'
