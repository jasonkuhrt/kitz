import type { ConventionalCommits } from '@kitz/conventional-commits'
import { Context } from 'effect'

/** PR data available to lint rules. */
export interface Pr {
  /** PR number. */
  readonly number: number
  /** PR title (raw). */
  readonly title: string
  /** PR body (raw). */
  readonly body: string
  /** Parsed conventional commit from title. */
  readonly commit: ConventionalCommits.Commit.Commit
}

/** Service providing PR context. */
export class PrService extends Context.Tag('PrService')<PrService, Pr>() {}
