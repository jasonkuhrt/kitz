import { FileSystem } from 'effect'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import type { Package } from './workspace.js'

/**
 * Dependency graph: package name -> list of packages that depend on it.
 *
 * A plain adjacency map so it plugs directly into `@kitz/graph` algorithms
 * (`Graph.transitiveClosure`, `Graph.findPath`).
 */
export type DependencyGraph = ReadonlyMap<string, ReadonlyArray<string>>

/**
 * Build a reverse dependency graph from package.json files.
 *
 * Maps each package name to the list of packages that depend on it.
 * Uses Effect's FileSystem service for testability.
 */
export const buildDependencyGraph = (
  packages: readonly Package[],
): Effect.Effect<DependencyGraph, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Adjacency/lookup input for @kitz/graph's ReadonlyMap-based API.
    const graph = new Map<string, string[]>(packages.map((p) => [p.name.moniker, []]))
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Adjacency/lookup input for @kitz/graph's ReadonlyMap-based API.
    const packageNames = new Set(packages.map((p) => p.name.moniker))

    for (const pkg of packages) {
      // Read manifest using typed resource
      const manifestOption = yield* Pkg.Manifest.resource.read(pkg.path)
      if (Option.isNone(manifestOption)) continue

      const manifest = manifestOption.value

      // Cascades only follow runtime dependency edges. Dev and peer dependency
      // changes do not require re-publishing dependents.
      for (const depName of Object.keys(manifest.dependencies ?? {})) {
        // Only track workspace dependencies
        if (!packageNames.has(depName)) continue
        graph.get(depName)!.push(pkg.name.moniker)
      }
    }

    return graph
  })

/**
 * Filter release candidates to those that directly trigger a cascade of the
 * given package — i.e. whose package the cascaded package directly depends on.
 *
 * Shared by the analyzer (to attribute `triggeredBy` on cascade impacts) and
 * the planner (to synthesize cascade commits naming their triggers).
 */
export const findDirectTriggers = <item extends { readonly package: Package }>(
  dependencyGraph: DependencyGraph,
  candidates: readonly item[],
  cascadedPackageName: string,
): item[] =>
  candidates.filter((candidate) =>
    (dependencyGraph.get(candidate.package.name.moniker) ?? []).includes(cascadedPackageName),
  )
