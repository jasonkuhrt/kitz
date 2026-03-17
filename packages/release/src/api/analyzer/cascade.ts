import { FileSystem } from 'effect'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, HashMap, HashSet, MutableHashMap, Option } from 'effect'
import type { Package } from './workspace.js'

/**
 * Dependency graph: package name -> list of packages that depend on it.
 */
export type DependencyGraph = HashMap.HashMap<string, readonly string[]>

/**
 * Build a reverse dependency graph from package.json files.
 *
 * Maps each package name to the list of packages that depend on it.
 * Uses Effect's FileSystem service for testability.
 */
export const buildDependencyGraph = (
  packages: Package[],
): Effect.Effect<DependencyGraph, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const graph = MutableHashMap.fromIterable(
      packages.map((p): [string, string[]] => [p.name.moniker, []]),
    )
    const packageNames = HashSet.fromIterable(packages.map((p) => p.name.moniker))

    for (const pkg of packages) {
      // Read manifest using typed resource
      const manifestOption = yield* Pkg.Manifest.resource.read(pkg.path)
      if (Option.isNone(manifestOption)) continue

      const manifest = manifestOption.value

      // Cascades only follow runtime dependency edges. Dev and peer dependency
      // changes do not require re-publishing dependents.
      for (const depName of Object.keys(manifest.dependencies ?? {})) {
        // Only track workspace dependencies
        if (!HashSet.has(packageNames, depName)) continue

        const dependents = Option.getOrElse(MutableHashMap.get(graph, depName), (): string[] => [])
        dependents.push(pkg.name.moniker)
        MutableHashMap.set(graph, depName, dependents)
      }
    }

    return HashMap.fromIterable(graph)
  })
