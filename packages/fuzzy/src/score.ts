import { Option } from 'effect'
import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { classifyHaystack, subsequenceScore } from './subsequence.js'

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
export function score(
  needle: string,
  haystack?: string,
): Option.Option<number> | ((haystack: string) => Option.Option<number>) {
  if (haystack === undefined) return (h: string) => scoreImpl(needle, h)
  return scoreImpl(needle, haystack)
}

const scoreImpl = (needle: string, haystack: string): Option.Option<number> => {
  if (needle.length === 0) return Option.some(0)

  // Token match: if the needle contains spaces, try matching each term
  // independently against the haystack. Terms can match in any order.
  // A reorder penalty applies when terms don't match in needle order.
  // This runs BEFORE hasMatch because hasMatch rejects space characters
  // not in the haystack, but token match splits on spaces and matches
  // each term independently (e.g. 'config reload' matches 'configReload').
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
  // All-whitespace needle: no terms to match but the needle wasn't empty,
  // so this is not a vacuous match — fall through to character-level matching.
  if (terms.length === 0) return null

  // Pre-compute haystack classification once, shared across all term scoring calls.
  const classification = classifyHaystack(haystack)

  const haystackLower = haystack.toLowerCase()
  const matchPositions: number[] = [] // first match position of each term
  const termScores: number[] = []

  for (const term of terms) {
    // Try subsequence match of term against full haystack, reusing classification
    const subseq = subsequenceScore(term, haystack, classification)
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

  // Reorder penalty: detect whether terms match haystack words in needle order.
  // Find which haystack word each term primarily matches (by first character
  // position), then check if word indices are monotonically increasing.
  // Word boundaries include whitespace, delimiters, AND camelCase transitions.
  const wordStarts = findTokenWordStarts(haystack, classification)
  const termWordIndices = matchPositions.map((pos) => {
    for (let w = wordStarts.length - 1; w >= 0; w--) {
      if (pos >= wordStarts[w]!) return w
    }
    return 0
  })

  let inOrder = true
  for (let i = 1; i < termWordIndices.length; i++) {
    if (termWordIndices[i]! < termWordIndices[i - 1]!) {
      inOrder = false
      break
    }
  }
  if (!inOrder) {
    // Multiplicative penalty ensures reordered terms always rank below in-order.
    // A flat penalty (-5) is too small when word-level boosters add 10-20+ points.
    total = Math.round(total * 0.7)
  }

  return total
}

/**
 * Find word start positions including camelCase transitions.
 * Unlike the subsequence/assignment word-start finders (which only use
 * whitespace/delimiters), this includes camelCase boundaries because
 * token match needs to detect reordering at the semantic word level.
 */
const findTokenWordStarts = (
  haystack: string,
  classification: { classes: number[]; bonuses: number[] },
): number[] => {
  const m = haystack.length
  const starts: number[] = [0]
  for (let j = 1; j < m; j++) {
    const prevCls = classification.classes[j - 1]!
    const currCls = classification.classes[j]!
    // Whitespace/delimiter boundary
    if (prevCls === CharClass.White || prevCls === CharClass.Delimiter) {
      starts.push(j)
    }
    // CamelCase transition: lowercase → uppercase
    else if (prevCls === CharClass.Lower && currCls === CharClass.Upper) {
      starts.push(j)
    }
  }
  return starts
}

import { CharClass, ScoreMatch } from './constants.js'
