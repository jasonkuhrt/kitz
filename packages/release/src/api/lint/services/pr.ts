import type { ConventionalCommits } from '@kitz/conventional-commits'
import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Result, Layer, Option, ServiceMap } from 'effect'

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
export class PrService extends ServiceMap.Service<PrService, Pr>()('PrService') {}

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
    Effect.result,
    Effect.map((parsed) =>
      Result.isSuccess(parsed)
        ? {
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body ?? '',
            commit: Option.some(parsed.success),
            titleParseError: Option.none(),
          }
        : {
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body ?? '',
            commit: Option.none(),
            titleParseError: Option.some(parsed.failure.message),
          },
    ),
  )

/** Safe default PR context for runs where PR-dependent rules are skipped. */
export const DefaultPrLayer = Layer.succeed(PrService, fallbackPr)
