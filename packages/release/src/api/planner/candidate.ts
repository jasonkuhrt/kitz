import { FileSystem } from '@effect/platform'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import { buildDependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/__.js'
import { findLatestPreviewNumber } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import * as Version from '../version/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { detect as detectCascades } from './cascade.js'
import { Candidate } from './models/item-candidate.js'
import type { Item } from './models/item.js'
import { Plan } from './models/plan.js'
import type { Context } from './official.js'
import type { Options } from './options.js'

/**
 * Detect cascades for candidate releases with candidate version format.
 */
const detectCascadesForCandidate = (
  packages: Package[],
  primaryReleases: Item[],
  dependencyGraph: Map<string, string[]>,
  tags: string[],
): Candidate[] => {
  // Get standard cascades (as official releases)
  const baseCascades = detectCascades(packages, primaryReleases, dependencyGraph, tags)

  // Convert to candidate releases
  return baseCascades.map((cascade) => {
    // Get the official version from the cascade (using getter)
    const baseVersion = cascade.nextVersion

    // Find existing candidate releases for this version
    const candidateNumber = findLatestPreviewNumber(cascade.package.name, baseVersion, tags)

    return Candidate.make({
      package: cascade.package,
      baseVersion,
      prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
      commits: cascade.commits,
    })
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
): Effect.Effect<
  Plan,
  Resource.ResourceError,
  FileSystem.FileSystem
> =>
  Effect.gen(function*() {
    // 1. Transform analysis impacts to candidate planned releases
    const releases: Candidate[] = []

    for (const impact of analysis.impacts) {
      // Apply exclude filter
      if (options?.exclude?.includes(impact.package.name.moniker)) continue

      // Apply include filter
      if (options?.packages && !options.packages.includes(impact.package.name.moniker)) continue

      // Calculate what the next official version would be
      const nextOfficialVersion = calculateNextVersion(impact.currentVersion, impact.bump)

      // Find existing candidate releases for this version
      const candidateNumber = findLatestPreviewNumber(impact.package.name, nextOfficialVersion, [...analysis.tags])

      releases.push(Candidate.make({
        package: impact.package,
        baseVersion: nextOfficialVersion,
        prerelease: Version.Candidate.make({ iteration: candidateNumber + 1 }),
        commits: impact.commits,
      }))
    }

    // 2. Detect cascade releases
    const dependencyGraph = yield* buildDependencyGraph([...ctx.packages])
    const cascades = detectCascadesForCandidate([...ctx.packages], releases, dependencyGraph, [...analysis.tags])

    return Plan.make({
      lifecycle: 'candidate',
      timestamp: new Date().toISOString(),
      releases,
      cascades,
    })
  })
