import type { ConventionalCommits } from '@kitz/conventional-commits'
import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Context, Effect, Either, Layer, Option } from 'effect'

/** PR data available to lint rules. */
export interface Pr {
  /** PR number. */
  readonly number: number
  /** PR title (raw). */
  readonly title: string
  /** PR body (raw). */
  readonly body: string
  /** Parsed conventional commit from title, when valid. */
  readonly commit: Option.Option<ConventionalCommits.Commit.Commit>
  /** Parse error for the PR title, when title is not a valid conventional commit. */
  readonly titleParseError: Option.Option<string>
}

/** Service providing PR context. */
export class PrService extends Context.Tag('PrService')<PrService, Pr>() {}

const fallbackPr: Pr = {
  number: 0,
  title: '',
  body: '',
  commit: Option.none(),
  titleParseError: Option.none(),
}

export const fromPullRequest = (pullRequest: {
  readonly number: number
  readonly title: string
  readonly body: string | null
}): Effect.Effect<Pr> =>
  CC.Title.parse(pullRequest.title).pipe(
    Effect.either,
    Effect.map((parsed) =>
      Either.isRight(parsed)
        ? {
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body ?? '',
            commit: Option.some(parsed.right),
            titleParseError: Option.none(),
          }
        : {
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body ?? '',
            commit: Option.none(),
            titleParseError: Option.some(parsed.left.message),
          },
    ),
  )

/** Safe default PR context for runs where PR-dependent rules are skipped. */
export const DefaultPrLayer = Layer.succeed(PrService, fallbackPr)
