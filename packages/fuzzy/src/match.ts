import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'

/**
 * Batch fuzzy matching: filter, score, and sort candidates against a query.
 *
 * Candidates that fail multiset containment are excluded. Results are sorted
 * by score descending. Candidates may include an optional `boost` field —
 * a number folded into the final score for external signals (proximity,
 * recency, frequency).
 *
 * `match` auto-tunes internal scoring based on `candidates.length`:
 * - ≤15 candidates: relaxed (assignment path scores close to subsequence)
 * - 15-80 candidates: balanced
 * - 80+ candidates: strict (assignment path scores penalized more)
 */
export const match = <T extends { readonly text: string; readonly boost?: number }>(
  candidates: readonly T[],
  query: string,
): ReadonlyArray<{ candidate: T; score: number }> => {
  if (query.length === 0) {
    return candidates
      .map((candidate) => ({ candidate, score: candidate.boost ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }

  // Candidate-count heuristic: how much to penalize assignment-path scores
  // relative to subsequence-path scores. Larger sets need more precision.
  const n = candidates.length
  const assignmentPenalty = n <= 15 ? 0 : n <= 80 ? 3 : 8

  const results: Array<{ candidate: T; score: number }> = []

  for (const candidate of candidates) {
    if (!hasMatch(query, candidate.text)) continue

    let matchScore = 0
    let isAssignmentPath = false

    // Try subsequence path first
    const subseq = subsequenceScore(query, candidate.text)
    if (subseq !== null) {
      matchScore = subseq.score
    } else {
      // Fall back to assignment path
      const assignment = assignmentScore(query, candidate.text)
      if (assignment !== null) {
        matchScore = assignment.score
        isAssignmentPath = true
      } else {
        continue
      }
    }

    // Apply candidate-count heuristic: penalize assignment-path scores
    // in larger sets to ensure subsequence matches dominate.
    if (isAssignmentPath) {
      matchScore -= assignmentPenalty
    }

    const boost = candidate.boost ?? 0
    results.push({ candidate, score: matchScore + boost })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
