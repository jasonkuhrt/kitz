import { FileSystem } from 'effect'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import type { Analysis } from '../analyzer/models/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import { detect as detectCascades } from './cascade.js'
import { planLifecycle } from './core.js'
import { Official } from './models/item-official.js'
import type { PlanOf } from './models/plan.js'
import { type Options } from './options.js'

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
): Effect.Effect<PlanOf<'official'>, Resource.ResourceError, FileSystem.FileSystem> =>
  planLifecycle({
    analysis,
    packages: ctx.packages,
    lifecycle: 'official',
    options,
    toPrimaryRelease: (impact) => {
      const nextVersion = calculateNextVersion(impact.currentVersion, impact.bump)
      const version: OfficialFirst | OfficialIncrement = Option.isSome(impact.currentVersion)
        ? OfficialIncrement.make({
            from: impact.currentVersion.value,
            to: nextVersion,
            bump: impact.bump,
          })
        : OfficialFirst.make({ version: nextVersion })

      return Official.make({
        package: impact.package,
        version,
        commits: impact.commits,
      })
    },
    toCascades: ({ packages, primaryReleases, dependencyGraph, tags }) =>
      detectCascades(packages, [...primaryReleases], dependencyGraph, [...tags]),
  })
