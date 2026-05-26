import { Context } from 'effect'
import type { Choice } from './choice.js'

/** A scored choice for ranking. */
export interface ScoredChoice {
  readonly choice: Choice
  readonly score: number
}

/** The Ranker service reorders choices beyond what the Matcher provides. */
export interface RankerService {
  readonly rank: (choices: ReadonlyArray<ScoredChoice>) => ReadonlyArray<Choice>
}

/** Effect service tag for Ranker. */
export class Ranker extends Context.Service<Ranker, RankerService>()('cmx/Ranker') {}

/** Default ranking: sort by score descending, alphabetical tiebreaker. */
export const defaultRanker: RankerService = {
  rank: (choices) =>
    [...choices]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.choice.token.localeCompare(b.choice.token)
      })
      .map((sc) => sc.choice),
}
