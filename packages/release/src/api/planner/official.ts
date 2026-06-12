import { FileSystem } from 'effect'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import type { Analysis } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import * as Version from '../version/__.js'
import { detect as detectCascades } from './cascade.js'
import { planLifecycle } from './core.js'
import { Official } from './models/item-official.js'
import type { PlanOf } from './models/plan.js'
import { type Options } from './options.js'

/**
 * Context required for planning.
 */
export interface Context {
  readonly packages: readonly Package[]
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
    toPrimaryRelease: (impact) =>
      Official.make({
        package: impact.package,
        version: Version.Official.fromCurrent(impact.currentVersion, impact.bump),
        commits: impact.commits,
      }),
    toSecondaryRelease: (release) => release,
    toCascades: ({ packages, primaryReleases, dependencyGraph, tags, timestamp }) =>
      detectCascades(packages, primaryReleases, dependencyGraph, tags, timestamp),
  })
