import { FileSystem } from '@effect/platform'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { buildDependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/__.js'
import { detect as detectCascades } from './cascade.js'
import { Stable } from './models/item-stable.js'
import { Plan } from './models/plan.js'
import type { StableVersion } from './models/stable-version.js'
import { StableVersionFirst, StableVersionIncrement } from './models/stable-version.js'
import type { Options } from './options.js'
import { calculateNextVersion } from './version.js'

/**
 * Context required for planning.
 */
export interface Context {
  readonly packages: readonly import('../analyzer/workspace.js').Package[]
}

/**
 * Plan a stable release from a pre-computed Analysis.
 *
 * Receives impacts and cascades from the Analyzer, applies version
 * arithmetic, and assembles a Plan.
 *
 * @example
 * ```ts
 * const analysis = yield* Analyzer.analyze(recon, packages)
 * const plan = yield* Planner.stable(analysis, ctx)
 * ```
 */
export const stable = (
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
    const releases: Stable[] = []

    for (const impact of analysis.impacts) {
      // Apply exclude filter
      if (options?.exclude?.includes(impact.package.name.moniker)) continue

      // Apply include filter
      if (options?.packages && !options.packages.includes(impact.package.name.moniker)) continue

      // Calculate next version from impact
      const nextVersion = calculateNextVersion(impact.currentVersion, impact.bump)

      // Build version union
      const version: StableVersion = Option.isSome(impact.currentVersion)
        ? StableVersionIncrement.make({ from: impact.currentVersion.value, to: nextVersion, bump: impact.bump })
        : StableVersionFirst.make({ version: nextVersion })

      releases.push(Stable.make({
        package: impact.package,
        version,
        commits: impact.commits,
      }))
    }

    // 2. Detect cascade releases (packages that depend on released packages)
    const dependencyGraph = yield* buildDependencyGraph([...ctx.packages])
    const cascades = detectCascades([...ctx.packages], releases, dependencyGraph, analysis.tags)

    return Plan.withAnalysis({
      type: 'stable',
      timestamp: new Date().toISOString(),
      releases,
      cascades,
    }, analysis)
  })
