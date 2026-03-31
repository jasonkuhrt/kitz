import { Option } from 'effect'
import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'
import { tokenMatch } from './token-match.js'

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
    const result = tokenMatch(needle, haystack)
    if (result !== null) return Option.some(result.score)
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
