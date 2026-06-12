import { FileSystem } from 'effect'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import type { Analysis } from '../analyzer/models/__.js'
import { findLatestCandidateNumber } from '../analyzer/version.js'
import * as Version from '../version/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { mapOfficialCascades, planLifecycle } from './core.js'
import { Candidate } from './models/item-candidate.js'
import type { Official } from './models/item-official.js'
import type { PlanOf } from './models/plan.js'
import type { Context } from './official.js'
import { type Options } from './options.js'

const toCandidateRelease = (release: Official, tags: readonly string[]): Candidate => {
  const baseVersion = release.nextVersion
  const candidateNumber = findLatestCandidateNumber(release.package.name, baseVersion, tags)

  return Candidate.make({
    package: release.package,
    baseVersion,
    prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
    commits: release.commits,
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
      const candidateNumber = findLatestCandidateNumber(
        impact.package.name,
        nextOfficialVersion,
        analysis.tags,
      )

      return Candidate.make({
        package: impact.package,
        baseVersion: nextOfficialVersion,
        prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
        commits: impact.commits,
      })
    },
    toSecondaryRelease: (release) => toCandidateRelease(release, analysis.tags),
    toCascades: (params) =>
      mapOfficialCascades({
        ...params,
        map: (cascade) => toCandidateRelease(cascade, params.tags),
      }),
  })
