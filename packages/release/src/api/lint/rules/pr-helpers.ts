import type { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, Option } from 'effect'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { PrTitle } from '../models/violation-location.js'
import { type Pr, PrService } from '../services/pr.js'

/** Standard violation for a PR title that does not parse as a conventional commit. */
const invalidTitleViolation = (pr: Pr): Violation => {
  const detail = Option.getOrUndefined(pr.titleParseError)
  return Violation.make({
    location: PrTitle.make({ title: pr.title }),
    summary: 'PR title is not a valid conventional commit title.',
    ...(detail === undefined ? {} : { detail }),
    hints: [
      Hint.make({
        description:
          'Rewrite the PR title using the release conventional commit syntax before running PR doctor checks.',
      }),
    ],
    docs: [
      DocLink.make({
        label: 'Conventional Commits',
        url: 'https://www.conventionalcommits.org/en/v1.0.0/',
      }),
    ],
  })
}

/**
 * Run a PR-title rule body against the parsed conventional commit.
 *
 * Reads the {@link PrService}; when the PR title did not parse, returns the
 * standard invalid-title violation instead of running `f`.
 */
export const withParsedTitle = <A, CheckError, R>(
  f: (commit: ConventionalCommits.Commit.Commit, pr: Pr) => Effect.Effect<A, CheckError, R>,
): Effect.Effect<A | Violation, CheckError, PrService | R> =>
  Effect.gen(function* () {
    const pr = yield* PrService
    return yield* Option.match(pr.commit, {
      onNone: () => Effect.succeed(invalidTitleViolation(pr)),
      onSome: (commit) => f(commit, pr),
    })
  })
