import type { ConventionalCommits } from '@kitz/conventional-commits'
import { Option, Context, Layer } from 'effect'
import { ConventionalCommits as CC } from '@kitz/conventional-commits'

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

/** Safe default PR context for runs where PR-dependent rules are skipped. */
export const DefaultPrLayer = Layer.succeed(PrService, {
  number: 0,
  title: '',
  body: '',
  commit: CC.Commit.Single.make({
    type: CC.Type.parse('chore'),
    scopes: [],
    breaking: false,
    message: '',
    body: Option.none(),
    footers: [],
  }),
} satisfies Pr)
