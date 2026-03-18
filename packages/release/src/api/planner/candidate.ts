import { FileSystem } from 'effect'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import type { Analysis } from '../analyzer/models/__.js'
import { findLatestCandidateNumber } from '../analyzer/version.js'
import * as Version from '../version/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { mapOfficialCascades, planLifecycle } from './core.js'
import { Candidate } from './models/item-candidate.js'
import type { PlanOf } from './models/plan.js'
import type { Context } from './official.js'
import { type Options } from './options.js'

/**
 * Detect cascades for candidate releases with candidate version format.
 */
const detectCascadesForCandidate = (
  packages: import('../analyzer/workspace.js').Package[],
  primaryReleases: readonly Candidate[],
  dependencyGraph: import('../analyzer/cascade.js').DependencyGraph,
  tags: string[],
): readonly Candidate[] => {
  return mapOfficialCascades({
    packages,
    primaryReleases,
    dependencyGraph,
    tags,
    map: (cascade) => {
      const baseVersion = cascade.nextVersion
      const candidateNumber = findLatestCandidateNumber(cascade.package.name, baseVersion, tags)

      return Candidate.make({
        package: cascade.package,
        baseVersion,
        prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
        commits: cascade.commits,
      })
    },
  })
}

/**
 * Plan a candidate (prerelease) release from a pre-computed Analysis.
 *
 * Receives impacts from the Analyzer, applies candidate version arithmetic,
 * and assembles a Plan. Candidate versions follow the pattern:
 * `${nextOfficial}-next.${n}`
 *
 * @example
 * ```ts
 * const analysis = yield* Analyzer.analyze(recon, packages)
 * const plan = yield* Planner.candidate(analysis, ctx)
 * ```
 */
export const candidate = (
  analysis: Analysis,
  ctx: Context,
  options?: Options,
): Effect.Effect<PlanOf<'candidate'>, Resource.ResourceError, FileSystem.FileSystem> =>
  planLifecycle({
    analysis,
    packages: ctx.packages,
    lifecycle: 'candidate',
    options,
    toPrimaryRelease: (impact) => {
      const nextOfficialVersion = calculateNextVersion(impact.currentVersion, impact.bump)
      const candidateNumber = findLatestCandidateNumber(impact.package.name, nextOfficialVersion, [
        ...analysis.tags,
      ])

      return Candidate.make({
        package: impact.package,
        baseVersion: nextOfficialVersion,
        prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
        commits: impact.commits,
      })
    },
    toCascades: ({ packages, primaryReleases, dependencyGraph, tags }) =>
      detectCascadesForCandidate(packages, primaryReleases, dependencyGraph, [...tags]),
  })
