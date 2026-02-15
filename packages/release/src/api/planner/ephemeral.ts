import { FileSystem } from '@effect/platform'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import { buildDependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/__.js'
import { findLatestPrNumber } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { detectPrNumber } from '../explorer/explore.js'
import * as Version from '../version/__.js'
import { detect as detectCascades } from './cascade.js'
import { ReleaseError } from './errors.js'
import { Ephemeral } from './models/item-ephemeral.js'
import type { Item } from './models/item.js'
import { Plan } from './models/plan.js'
import type { Context } from './official.js'
import type { PrOptions } from './options.js'

/**
 * Detect cascades for ephemeral releases with ephemeral version format.
 */
const detectCascadesForEphemeral = (
  packages: Package[],
  primaryReleases: Item[],
  dependencyGraph: Map<string, string[]>,
  tags: string[],
  prNumber: number,
  sha: Git.Sha.Sha,
): Ephemeral[] => {
  // Get standard cascades (as official releases)
  const baseCascades = detectCascades(packages, primaryReleases, dependencyGraph, tags)

  // Convert to ephemeral releases
  return baseCascades.map((cascade) => {
    const prReleaseNumber = findLatestPrNumber(cascade.package.name, prNumber, tags)

    return Ephemeral.make({
      package: cascade.package,
      prerelease: Version.Ephemeral.make({ prNumber, iteration: prReleaseNumber + 1, sha }),
      commits: cascade.commits,
    })
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
  options?: PrOptions,
): Effect.Effect<
  Plan,
  ReleaseError | Git.GitError | Git.GitParseError | Resource.ResourceError,
  Git.Git | FileSystem.FileSystem | Env.Env
> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const env = yield* Env.Env

    // 1. Detect PR number
    const prNumber = options?.prNumber ?? detectPrNumber(env.vars)
    if (prNumber === null) {
      return yield* Effect.fail(
        new ReleaseError({
          context: {
            operation: 'plan',
            detail:
              'Could not detect PR number. Set PR_NUMBER or GITHUB_PR_NUMBER environment variable, or pass prNumber option.',
          },
        }),
      )
    }

    // 2. Get HEAD SHA
    const shaString = yield* git.getHeadSha()
    const sha = Git.Sha.make(shaString)

    // 3. Transform analysis impacts to ephemeral planned releases
    const releases: Ephemeral[] = []

    for (const impact of analysis.impacts) {
      // Apply exclude filter
      if (options?.exclude?.includes(impact.package.name.moniker)) continue

      // Apply include filter
      if (options?.packages && !options.packages.includes(impact.package.name.moniker)) continue

      // Find existing ephemeral releases for this PR
      const prReleaseNumber = findLatestPrNumber(impact.package.name, prNumber, [...analysis.tags])

      releases.push(Ephemeral.make({
        package: impact.package,
        prerelease: Version.Ephemeral.make({ prNumber, iteration: prReleaseNumber + 1, sha }),
        commits: impact.commits,
      }))
    }

    // 4. Detect cascade releases
    const dependencyGraph = yield* buildDependencyGraph([...ctx.packages])
    const cascades = detectCascadesForEphemeral(
      [...ctx.packages],
      releases,
      dependencyGraph,
      [...analysis.tags],
      prNumber,
      sha,
    )

    return Plan.make({
      lifecycle: 'ephemeral',
      timestamp: new Date().toISOString(),
      releases,
      cascades,
    })
  })
