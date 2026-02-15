import { FileSystem } from '@effect/platform'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import { buildDependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/__.js'
import { PreviewPrerelease } from '../analyzer/prerelease.js'
import { findLatestPreviewNumber } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { detect as detectCascades } from './cascade.js'
import { Preview } from './models/item-preview.js'
import type { Item } from './models/item.js'
import { Plan } from './models/plan.js'
import type { Options } from './options.js'
import type { Context } from './stable.js'
import { calculateNextVersion } from './version.js'

/**
 * Detect cascades for preview releases with preview version format.
 */
const detectCascadesForPreview = (
  packages: Package[],
  primaryReleases: Item[],
  dependencyGraph: Map<string, string[]>,
  tags: string[],
): Preview[] => {
  // Get standard cascades (as stable releases)
  const baseCascades = detectCascades(packages, primaryReleases, dependencyGraph, tags)

  // Convert to preview releases
  return baseCascades.map((cascade) => {
    // Get the stable version from the cascade (using getter)
    const baseVersion = cascade.nextVersion

    // Find existing preview releases for this version
    const previewNumber = findLatestPreviewNumber(cascade.package.name, baseVersion, tags)

    return Preview.make({
      package: cascade.package,
      baseVersion,
      prerelease: PreviewPrerelease.make({ iteration: previewNumber + 1 }),
      commits: cascade.commits,
    })
  })
}

/**
 * Plan a preview (canary) release from a pre-computed Analysis.
 *
 * Receives impacts from the Analyzer, applies preview version arithmetic,
 * and assembles a Plan. Preview versions follow the pattern:
 * `${nextStable}-next.${n}`
 *
 * @example
 * ```ts
 * const analysis = yield* Analyzer.analyze(recon, packages)
 * const plan = yield* Planner.preview(analysis, ctx)
 * ```
 */
export const preview = (
  analysis: Analysis,
  ctx: Context,
  options?: Options,
): Effect.Effect<
  Plan,
  Resource.ResourceError,
  FileSystem.FileSystem
> =>
  Effect.gen(function*() {
    // 1. Transform analysis impacts to preview planned releases
    const releases: Preview[] = []

    for (const impact of analysis.impacts) {
      // Apply exclude filter
      if (options?.exclude?.includes(impact.package.name.moniker)) continue

      // Apply include filter
      if (options?.packages && !options.packages.includes(impact.package.name.moniker)) continue

      // Calculate what the next stable version would be
      const nextStableVersion = calculateNextVersion(impact.currentVersion, impact.bump)

      // Find existing preview releases for this version
      const previewNumber = findLatestPreviewNumber(impact.package.name, nextStableVersion, analysis.tags)

      releases.push(Preview.make({
        package: impact.package,
        baseVersion: nextStableVersion,
        prerelease: PreviewPrerelease.make({ iteration: previewNumber + 1 }),
        commits: impact.commits,
      }))
    }

    // 2. Detect cascade releases
    const dependencyGraph = yield* buildDependencyGraph([...ctx.packages])
    const cascades = detectCascadesForPreview([...ctx.packages], releases, dependencyGraph, analysis.tags)

    return Plan.withAnalysis({
      type: 'preview',
      timestamp: new Date().toISOString(),
      releases,
      cascades,
    }, analysis)
  })
