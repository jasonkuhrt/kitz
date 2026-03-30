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
export const score: {
  (needle: string, haystack: string): Option.Option<number>
  (needle: string): (haystack: string) => Option.Option<number>
} = (...args: [string, string?]): any => {
  if (args.length === 1) {
    const needle = args[0]
    return (haystack: string) => scoreImpl(needle, haystack)
  }
  return scoreImpl(args[0], args[1]!)
}

const scoreImpl = (needle: string, haystack: string): Option.Option<number> => {
  if (needle.length === 0) return Option.some(0)
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
