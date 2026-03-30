import { Option } from 'effect'
import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'

/**
 * Return the haystack indices where needle characters matched, in needle order.
 * `positions[0]` = where `needle[0]` matched, etc.
 *
 * Returns `Option.none()` when multiset containment fails (characters missing).
 * For subsequence matches, returns the optimal DP alignment positions.
 * For out-of-order matches, returns the greedy+repair assignment positions.
 *
 * Data-first form: `positions(needle, haystack)`
 * Data-last form: `positions(needle)` returns `(haystack) => Option<ReadonlyArray<number>>`
 */
export const positions: {
  (needle: string, haystack: string): Option.Option<ReadonlyArray<number>>
  (needle: string): (haystack: string) => Option.Option<ReadonlyArray<number>>
} = (...args: [string, string?]): any => {
  if (args.length === 1) {
    const needle = args[0]
    return (haystack: string) => positionsImpl(needle, haystack)
  }
  return positionsImpl(args[0], args[1]!)
}

const positionsImpl = (needle: string, haystack: string): Option.Option<ReadonlyArray<number>> => {
  if (needle.length === 0) return Option.some([])
  if (!hasMatch(needle, haystack)) return Option.none()

  const subseq = subsequenceScore(needle, haystack)
  if (subseq !== null) return Option.some(subseq.positions)

  const assignment = assignmentScore(needle, haystack)
  if (assignment !== null) return Option.some(assignment.positions)

  return Option.none()
}
