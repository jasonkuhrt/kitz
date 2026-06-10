import { FileSystem } from 'effect'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, HashMap, MutableHashSet, Option } from 'effect'
import { buildDependencyGraph, type DependencyGraph } from '../analyzer/cascade.js'
import { makeCascadeCommit, type ReleaseCommit } from '../analyzer/models/commit.js'
import { findLatestTagVersion } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { calculateNextVersion } from '../version/calculate.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import { Official } from './models/item-official.js'
import type { Item } from './models/item.js'

const syntheticCommitDate = '1970-01-01T00:00:00.000Z'

/**
 * Result of cascade analysis for a single requested package identifier.
 *
 * - `packageName` is null when the requested identifier does not match any workspace package.
 * - `cascades` is empty when the package has no dependents that need cascade releases.
 */
export interface CascadeQueryResult {
  readonly requestedPackage: string
  readonly packageName: string | null
  readonly cascades: readonly Official[]
}

/**
 * Analyze cascade impact for a list of requested package identifiers.
 *
 * Requested identifiers may be either full package names or workspace scopes.
 */
export const analyzeRequested = (
  packages: Package[],
  releases: readonly Item[],
  requestedPackages: readonly string[],
  tags: string[],
): Effect.Effect<readonly CascadeQueryResult[], Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const dependencyGraph = yield* buildDependencyGraph(packages)
    const results: CascadeQueryResult[] = []

    for (const requestedPackage of requestedPackages) {
      const pkg = packages.find(
        (p) => p.name.moniker === requestedPackage || p.scope === requestedPackage,
      )

      if (!pkg) {
        yield* Effect.logWarning(
          `Cascade analysis: requested package "${requestedPackage}" not found in workspace. ` +
            `Available packages: ${packages.map((p) => p.name.moniker).join(', ')}`,
        )
        results.push({
          requestedPackage,
          packageName: null,
          cascades: [],
        })
        continue
      }

      const pkgReleases = releases.filter(
        (release) => release.package.name.moniker === pkg.name.moniker,
      )
      const cascades = detect(packages, pkgReleases, dependencyGraph, tags)

      results.push({
        requestedPackage,
        packageName: pkg.name.moniker,
        cascades,
      })
    }

    return results
  })

/**
 * Find all packages that need cascade releases using BFS traversal.
 *
 * **Algorithm**: Starting from the set of primary releases, performs a
 * breadth-first search over the reverse dependency graph (dependents).
 * Each unvisited dependent is marked for a cascade patch release.
 * The BFS continues from cascade packages to find transitive dependents.
 *
 * A package needs a cascade release if:
 * 1. It depends (directly or transitively) on a package being released
 * 2. It is not already in the primary releases list
 *
 * **Circular dependencies**: The visited set prevents infinite loops.
 * If A depends on B and B depends on A, each is visited at most once.
 *
 * **Version strategy**: All cascade releases receive a patch bump.
 * If no current version exists, a first release is created.
 */
export const detect = (
  packages: Package[],
  primaryReleases: Item[],
  dependencyGraph: DependencyGraph,
  tags: string[],
  timestamp: string = syntheticCommitDate,
): Official[] => {
  // Set of packages already getting released (use string form for Set/Map operations)
  const releasing = MutableHashSet.fromIterable(primaryReleases.map((r) => r.package.name.moniker))

  // Set of packages that need cascade releases
  const needsCascade = MutableHashSet.empty<string>()

  // BFS traversal with visited guard to handle circular dependencies safely
  const visited = MutableHashSet.fromIterable(releasing)
  const queue = Array.from(releasing)

  while (queue.length > 0) {
    const pkgName = queue.shift()!
    const dependents = Option.getOrElse(
      HashMap.get(dependencyGraph, pkgName),
      (): readonly string[] => [],
    )

    for (const dependent of dependents) {
      // Skip if already visited (releasing, already queued for cascade, or in queue)
      if (MutableHashSet.has(visited, dependent)) continue

      MutableHashSet.add(visited, dependent)
      MutableHashSet.add(needsCascade, dependent)
      queue.push(dependent) // Propagate cascades
    }
  }

  // Build cascade releases (use string keys for Map lookup)
  const nameToPackage = HashMap.fromIterable(
    packages.map((p): [string, Package] => [p.name.moniker, p]),
  )
  const cascades: Official[] = []

  for (const name of needsCascade) {
    const pkg = Option.getOrUndefined(HashMap.get(nameToPackage, name))
    if (!pkg) continue

    const currentVersion = findLatestTagVersion(pkg.name, tags)
    const nextVersion = calculateNextVersion(currentVersion, 'patch')

    // Find which primary release(s) triggered this cascade
    // Create synthetic commit entries for changelog generation
    const cascadeCommits: ReleaseCommit[] = []
    for (const primary of primaryReleases) {
      const primaryDependents = Option.getOrElse(
        HashMap.get(dependencyGraph, primary.package.name.moniker),
        (): readonly string[] => [],
      )
      if (primaryDependents.includes(name)) {
        cascadeCommits.push(
          makeCascadeCommit(
            pkg.scope,
            `Depends on ${primary.package.name.moniker}@${primary.nextVersion.toString()}`,
            timestamp,
          ),
        )
      }
    }

    // If no triggers found, add a generic cascade commit
    if (cascadeCommits.length === 0) {
      cascadeCommits.push(makeCascadeCommit(pkg.scope, 'Cascade release', timestamp))
    }

    // Build version union
    const version: OfficialFirst | OfficialIncrement = Option.isSome(currentVersion)
      ? OfficialIncrement.make({ from: currentVersion.value, to: nextVersion, bump: 'patch' })
      : OfficialFirst.make({ version: nextVersion, bump: 'patch' })

    cascades.push(
      Official.make({
        package: pkg,
        version,
        commits: cascadeCommits,
      }),
    )
  }

  return cascades
}

const makePatchRelease = (pkg: Package, tags: readonly string[], commits: ReleaseCommit[]) => {
  const currentVersion = findLatestTagVersion(pkg.name, [...tags])
  const nextVersion = calculateNextVersion(currentVersion, 'patch')
  const version: OfficialFirst | OfficialIncrement = Option.isSome(currentVersion)
    ? OfficialIncrement.make({ from: currentVersion.value, to: nextVersion, bump: 'patch' })
    : OfficialFirst.make({ version: nextVersion, bump: 'patch' })

  return Official.make({
    package: pkg,
    version,
    commits,
  })
}

/**
 * Find runtime workspace dependencies that must be part of a publish plan.
 *
 * Artifact staging rewrites workspace dependency specifiers from the planned
 * version map. If a planned package has a runtime workspace dependency outside
 * the plan, its staged manifest still contains `workspace:*` and cannot pack.
 */
export const detectPublishDependencyClosure = (
  packages: readonly Package[],
  plannedItems: readonly Item[],
  tags: readonly string[],
  timestamp: string = syntheticCommitDate,
): Effect.Effect<readonly Official[], Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const localPackageNames = packages.map((pkg) => pkg.name.moniker)
    const packageByName = HashMap.fromIterable(
      packages.map((pkg): [string, Package] => [pkg.name.moniker, pkg]),
    )
    const plannedNames = MutableHashSet.fromIterable(
      plannedItems.map((item) => item.package.name.moniker),
    )
    const queue = plannedItems.map((item) => item.package.name.moniker)
    const closureReleases: Official[] = []

    while (queue.length > 0) {
      const packageName = queue.shift()!
      const pkg = Option.getOrUndefined(HashMap.get(packageByName, packageName))
      if (pkg === undefined) continue

      const manifestOption = yield* Pkg.Manifest.resource.read(pkg.path)
      if (Option.isNone(manifestOption)) continue

      for (const dependencyName of Pkg.Manifest.findPublishedManifestWorkspaceDependencyNames(
        manifestOption.value,
        localPackageNames,
      )) {
        if (MutableHashSet.has(plannedNames, dependencyName)) continue

        const dependencyPackage = Option.getOrUndefined(HashMap.get(packageByName, dependencyName))
        if (dependencyPackage === undefined) continue

        MutableHashSet.add(plannedNames, dependencyName)
        queue.push(dependencyName)
        closureReleases.push(
          makePatchRelease(dependencyPackage, tags, [
            makeCascadeCommit(
              dependencyPackage.scope,
              `Runtime dependency of ${packageName}`,
              timestamp,
            ),
          ]),
        )
      }
    }

    return closureReleases
  })
