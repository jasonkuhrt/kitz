import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import type { Analysis } from '../analyzer/models/__.js'
import { findLatestEphemeralNumber } from '../analyzer/version.js'
import { ExplorerError } from '../explorer/errors.js'
import { resolvePrNumber } from '../explorer/explore.js'
import * as Version from '../version/__.js'
import { mapOfficialCascades, planLifecycle } from './core.js'
import { ReleaseError } from './errors.js'
import { Ephemeral } from './models/item-ephemeral.js'
import type { PlanOf } from './models/plan.js'
import type { Context } from './official.js'
import { type EphemeralOptions } from './options.js'

/**
 * Detect cascades for ephemeral releases with ephemeral version format.
 */
const detectCascadesForEphemeral = (
  packages: import('../analyzer/workspace.js').Package[],
  primaryReleases: readonly Ephemeral[],
  dependencyGraph: import('../analyzer/cascade.js').DependencyGraph,
  tags: string[],
  prNumber: number,
  sha: Git.Sha.Sha,
): readonly Ephemeral[] => {
  return mapOfficialCascades({
    packages,
    primaryReleases,
    dependencyGraph,
    tags,
    map: (cascade) => {
      const prReleaseNumber = findLatestEphemeralNumber(cascade.package.name, prNumber, tags)

      return Ephemeral.make({
        package: cascade.package,
        prerelease: Version.Ephemeral.make({ prNumber, iteration: prReleaseNumber + 1, sha }),
        commits: cascade.commits,
      })
    },
  })
}

/**
 * Plan an ephemeral release from a pre-computed Analysis.
 *
 * Receives impacts from the Analyzer, applies ephemeral version arithmetic,
 * and assembles a Plan. Ephemeral versions follow the pattern:
 * `0.0.0-pr.${prNumber}.${n}.${sha}`
 *
 * @example
 * ```ts
 * const analysis = yield* Analyzer.analyze(recon, packages)
 * const plan = yield* Planner.ephemeral(analysis, ctx, { prNumber: 123 })
 * ```
 */
export const ephemeral = (
  analysis: Analysis,
  ctx: Context,
  options?: EphemeralOptions,
): Effect.Effect<
  PlanOf<'ephemeral'>,
  | ReleaseError
  | ExplorerError
  | Git.GitError
  | Git.GitParseError
  | Github.GithubError
  | Github.GithubNotFoundError
  | Github.GithubAuthError
  | Github.GithubRateLimitError
  | Resource.ResourceError,
  Git.Git | FileSystem.FileSystem | Env.Env
> =>
  Effect.gen(function* () {
    const git = yield* Git.Git

    // 1. Detect PR number
    const prNumber = options?.prNumber ?? (yield* resolvePrNumber())
    if (prNumber === null) {
      return yield* Effect.fail(
        new ReleaseError({
          context: {
            operation: 'plan',
            detail:
              'Could not detect PR number from environment or an open pull request connected to the current branch. ' +
              'Set PR_NUMBER or GITHUB_PR_NUMBER, or pass prNumber option.',
          },
        }),
      )
    }

    // 2. Get HEAD SHA
    const shaString = yield* git.getHeadSha()
    const sha = Git.Sha.make(shaString)

    return yield* planLifecycle({
      analysis,
      packages: ctx.packages,
      lifecycle: 'ephemeral',
      options,
      toPrimaryRelease: (impact) => {
        const prReleaseNumber = findLatestEphemeralNumber(impact.package.name, prNumber, [
          ...analysis.tags,
        ])

        return Ephemeral.make({
          package: impact.package,
          prerelease: Version.Ephemeral.make({
            prNumber,
            iteration: prReleaseNumber + 1,
            sha,
          }),
          commits: impact.commits,
        })
      },
      toCascades: ({ packages, primaryReleases, dependencyGraph, tags }) =>
        detectCascadesForEphemeral(
          packages,
          primaryReleases,
          dependencyGraph,
          [...tags],
          prNumber,
          sha,
        ),
    })
  })
