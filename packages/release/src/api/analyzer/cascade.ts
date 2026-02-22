import { FileSystem } from '@effect/platform'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import type { Package } from './workspace.js'

/**
 * Dependency graph: package name -> list of packages that depend on it.
 */
export type DependencyGraph = Map<string, string[]>

/**
 * Build a reverse dependency graph from package.json files.
 *
 * Maps each package name to the list of packages that depend on it.
 * Uses Effect's FileSystem service for testability.
 */
export const buildDependencyGraph = (
  packages: Package[],
): Effect.Effect<DependencyGraph, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const graph: DependencyGraph = new Map()
    const packageNames = new Set(packages.map((p) => p.name.moniker))

    // Initialize all packages with empty dependents
    for (const name of packageNames) {
      graph.set(name, [])
    }

    for (const pkg of packages) {
      // Read manifest using typed resource
      const manifestOption = yield* Pkg.Manifest.resource.read(pkg.path)
      if (Option.isNone(manifestOption)) continue

      const manifest = manifestOption.value

      // Check all dependency types
      const allDeps = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies,
      }

      for (const depName of Object.keys(allDeps)) {
        // Only track workspace dependencies
        if (!packageNames.has(depName)) continue

        const dependents = graph.get(depName) ?? []
        dependents.push(pkg.name.moniker)
        graph.set(depName, dependents)
      }
    }

    return graph
  })
