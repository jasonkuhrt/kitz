import { FileSystem } from '@effect/platform'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { buildDependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import { detect as detectCascades } from './cascade.js'
import { Official } from './models/item-official.js'
import { Plan } from './models/plan.js'
import type { Options } from './options.js'

/**
 * Context required for planning.
 */
export interface Context {
  readonly packages: readonly import('../analyzer/workspace.js').Package[]
}

/**
 * Plan an official release from a pre-computed Analysis.
 *
 * Receives impacts and cascades from the Analyzer, applies version
 * arithmetic, and assembles a Plan.
 *
 * @example
 * ```ts
 * const analysis = yield* Analyzer.analyze(recon, packages)
 * const plan = yield* Planner.official(analysis, ctx)
 * ```
 */
export const official = (
  analysis: Analysis,
  ctx: Context,
  options?: Options,
): Effect.Effect<
  Plan,
  Resource.ResourceError,
  FileSystem.FileSystem
> =>
  Effect.gen(function*() {
    // 1. Transform analysis impacts to planned releases
    const releases: Official[] = []

    for (const impact of analysis.impacts) {
      // Apply exclude filter
      if (options?.exclude?.includes(impact.package.name.moniker)) continue

      // Apply include filter
      if (options?.packages && !options.packages.includes(impact.package.name.moniker)) continue

      // Calculate next version from impact
      const nextVersion = calculateNextVersion(impact.currentVersion, impact.bump)

      // Build version union
      const version: OfficialFirst | OfficialIncrement = Option.isSome(impact.currentVersion)
        ? OfficialIncrement.make({ from: impact.currentVersion.value, to: nextVersion, bump: impact.bump })
        : OfficialFirst.make({ version: nextVersion })

      releases.push(Official.make({
        package: impact.package,
        version,
        commits: impact.commits,
      }))
    }

    // 2. Detect cascade releases (packages that depend on released packages)
    const dependencyGraph = yield* buildDependencyGraph([...ctx.packages])
    const cascades = detectCascades([...ctx.packages], releases, dependencyGraph, [...analysis.tags])

    return Plan.make({
      lifecycle: 'official',
      timestamp: new Date().toISOString(),
      releases,
      cascades,
    })
  })
