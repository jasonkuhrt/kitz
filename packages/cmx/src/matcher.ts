import { Fuzzy } from '@kitz/fuzzy'

/** A candidate for matching. */
export interface MatchCandidate {
  readonly text: string
  readonly boost?: number
}

/** A scored match result wrapping the original candidate. */
export interface MatchResult<T extends MatchCandidate> {
  readonly candidate: T
  readonly score: number
}

/**
 * Pluggable matching service for scoring and ranking candidates against
 * a query string. Implementations must return results sorted by score
 * descending. When query is empty, all candidates are returned with
 * score equal to their boost (defaulting to 0).
 */
export interface MatcherService {
  readonly match: <T extends MatchCandidate>(
    candidates: ReadonlyArray<T>,
    query: string,
  ) => ReadonlyArray<MatchResult<T>>
}

export const Matcher = {
  /**
   * Fuzzy matcher powered by `@kitz/fuzzy`. Uses subsequence scoring
   * with fzy's DP core and fzf's bonus constants. Candidates that fail
   * multiset containment are excluded.
   */
  fuzzy: (): MatcherService => ({
    match: <T extends MatchCandidate>(
      candidates: ReadonlyArray<T>,
      query: string,
    ): ReadonlyArray<MatchResult<T>> => Fuzzy.match(candidates, query),
  }),

  /**
   * Substring matcher that preserves the original resolver behavior:
   * case-insensitive contiguous substring containment with a
   * starts-with tiebreaker.
   */
  substring: (): MatcherService => ({
    match: <T extends MatchCandidate>(
      candidates: ReadonlyArray<T>,
      query: string,
    ): ReadonlyArray<MatchResult<T>> => {
      if (query === '') {
        return candidates
          .map((candidate) => ({ candidate, score: candidate.boost ?? 0 }))
          .sort((a, b) => b.score - a.score)
      }
      const lower = query.toLowerCase()
      return candidates
        .filter((c) => c.text.toLowerCase().includes(lower))
        .map((candidate) => ({
          candidate,
          score: (candidate.text.toLowerCase().startsWith(lower) ? 1 : 0) + (candidate.boost ?? 0),
        }))
        .sort((a, b) => b.score - a.score)
    },
  }),
} as const
