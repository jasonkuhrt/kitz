import { FileSystem } from '@effect/platform'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import * as PlanModels from './plan/models/__.js'
import { makeCascadeCommit, type ReleaseCommit } from './release-commit.js'
import type { Package } from './scanner.js'
import { calculateNextVersion, findLatestTagVersion } from './version.js'

/**
 * Dependency graph: package name -> list of packages that depend on it.
 */
export type DependencyGraph = Map<string, string[]>

/**
 * Cascade analysis for a requested package identifier.
 */
export interface RequestedCascadeAnalysis {
  readonly requestedPackage: string
  readonly packageName: string | null
  readonly cascades: readonly PlanModels.Stable[]
}

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

/**
 * Analyze cascade impact for a list of requested package identifiers.
 *
 * Requested identifiers may be either full package names or workspace scopes.
 */
export const analyzeRequested = (
  packages: Package[],
  releases: readonly PlanModels.Item[],
  requestedPackages: readonly string[],
  tags: string[],
): Effect.Effect<readonly RequestedCascadeAnalysis[], Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const dependencyGraph = yield* buildDependencyGraph(packages)

    return requestedPackages.map((requestedPackage) => {
      const pkg = packages.find((p) => p.name.moniker === requestedPackage || p.scope === requestedPackage)

      if (!pkg) {
        return {
          requestedPackage,
          packageName: null,
          cascades: [],
        } satisfies RequestedCascadeAnalysis
      }

      const pkgReleases = releases.filter((release) => release.package.name.moniker === pkg.name.moniker)
      const cascades = detect(packages, pkgReleases, dependencyGraph, tags)

      return {
        requestedPackage,
        packageName: pkg.name.moniker,
        cascades,
      } satisfies RequestedCascadeAnalysis
    })
  })

/**
 * Find all packages that need cascade releases.
 *
 * A package needs a cascade release if:
 * 1. It depends on a package being released
 * 2. It's not already in the primary releases list
 *
 * Cascade releases propagate recursively - if A depends on B and B depends on C,
 * and C is released, both B and A get cascade releases.
 */
export const detect = (
  packages: Package[],
  primaryReleases: PlanModels.Item[],
  dependencyGraph: DependencyGraph,
  tags: string[],
): PlanModels.Stable[] => {
  // Set of packages already getting released (use string form for Set/Map operations)
  const releasing = new Set(primaryReleases.map((r) => r.package.name.moniker))

  // Set of packages that need cascade releases
  const needsCascade = new Set<string>()

  // Queue for BFS traversal
  const queue = [...releasing]

  while (queue.length > 0) {
    const pkgName = queue.shift()!
    const dependents = dependencyGraph.get(pkgName) ?? []

    for (const dependent of dependents) {
      // Skip if already releasing or already queued for cascade
      if (releasing.has(dependent) || needsCascade.has(dependent)) continue

      needsCascade.add(dependent)
      queue.push(dependent) // Propagate cascades
    }
  }

  // Build cascade releases (use string keys for Map lookup)
  const nameToPackage = new Map(packages.map((p) => [p.name.moniker, p]))
  const cascades: PlanModels.Stable[] = []

  for (const name of needsCascade) {
    const pkg = nameToPackage.get(name)
    if (!pkg) continue

    const currentVersion = findLatestTagVersion(pkg.name, tags)
    const nextVersion = calculateNextVersion(currentVersion, 'patch')

    // Find which primary release(s) triggered this cascade
    // Create synthetic commit entries for changelog generation
    const cascadeCommits: ReleaseCommit[] = []
    const deps = dependencyGraph.get(name)
    if (deps) {
      for (const primary of primaryReleases) {
        if (deps.includes(primary.package.name.moniker)) {
          cascadeCommits.push(
            makeCascadeCommit(
              pkg.scope,
              `Depends on ${primary.package.name.moniker}@${primary.nextVersion.toString()}`,
            ),
          )
        }
      }
    }

    // If no triggers found, add a generic cascade commit
    if (cascadeCommits.length === 0) {
      cascadeCommits.push(makeCascadeCommit(pkg.scope, 'Cascade release'))
    }

    // Build version union
    const version: PlanModels.StableVersion = Option.isSome(currentVersion)
      ? PlanModels.StableVersionIncrement.make({ from: currentVersion.value, to: nextVersion, bump: 'patch' })
      : PlanModels.StableVersionFirst.make({ version: nextVersion })

    cascades.push(PlanModels.Stable.make({
      package: pkg,
      version,
      commits: cascadeCommits,
    }))
  }

  return cascades
}
