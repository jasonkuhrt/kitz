import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { FileSystem } from 'effect'
import { Effect, HashMap, Option } from 'effect'
import { buildDependencyGraph, type DependencyGraph } from '../analyzer/cascade.js'
import type { Analysis } from '../analyzer/models/analysis.js'
import type { ReleaseCommit } from '../analyzer/models/commit.js'
import { findLatestTagVersion } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { calculateNextVersion } from '../version/calculate.js'

export interface ExplainedPackage {
  readonly name: string
  readonly scope: string
  readonly path: string
}

export interface ExplanationDependencyPath {
  readonly packages: readonly ExplainedPackage[]
}

interface BaseExplanation {
  readonly requestedPackage: string
  readonly package: ExplainedPackage
  readonly currentVersion: string | null
}

export interface PrimaryExplanation extends BaseExplanation {
  readonly decision: 'primary'
  readonly nextOfficialVersion: string
  readonly bump: Semver.BumpType
  readonly commits: readonly ReleaseCommit[]
}

export interface CascadeExplanation extends BaseExplanation {
  readonly decision: 'cascade'
  readonly nextOfficialVersion: string
  readonly bump: 'patch'
  readonly triggeredBy: readonly ExplainedPackage[]
  readonly dependencyPaths: readonly ExplanationDependencyPath[]
}

export interface UnchangedExplanation extends BaseExplanation {
  readonly decision: 'unchanged'
  readonly nextOfficialVersion: null
}

export interface MissingExplanation {
  readonly decision: 'missing'
  readonly requestedPackage: string
  readonly availablePackages: readonly string[]
}

export type PackageExplanation =
  | PrimaryExplanation
  | CascadeExplanation
  | UnchangedExplanation
  | MissingExplanation

export interface ExplainOptions {
  readonly packages: readonly Package[]
  readonly requestedPackage: string
}

const toExplainedPackage = (pkg: Package): ExplainedPackage => ({
  name: pkg.name.moniker,
  scope: pkg.scope,
  path: Fs.Path.toString(pkg.path),
})

const toVersionString = (version: Option.Option<Semver.Semver>): string | null =>
  Option.match(version, {
    onNone: () => null,
    onSome: (value) => Semver.toString(value),
  })

const matchesRequestedPackage = (pkg: Package, requestedPackage: string): boolean =>
  pkg.name.moniker === requestedPackage || pkg.scope === requestedPackage

const resolveRequestedPackage = (
  packages: readonly Package[],
  requestedPackage: string,
): Package | undefined => packages.find((pkg) => matchesRequestedPackage(pkg, requestedPackage))

const findPathBetweenPackages = (
  dependencyGraph: DependencyGraph,
  startPackageName: string,
  targetPackageName: string,
): readonly string[] | undefined => {
  if (startPackageName === targetPackageName) return [startPackageName]

  const queue: Array<{ readonly current: string; readonly path: readonly string[] }> = [
    { current: startPackageName, path: [startPackageName] },
  ]
  const visited = [startPackageName]

  while (queue.length > 0) {
    const next = queue.shift()!
    const dependents = Option.getOrElse(
      HashMap.get(dependencyGraph, next.current),
      (): readonly string[] => [],
    )

    for (const dependent of dependents) {
      if (visited.includes(dependent)) continue

      const path = [...next.path, dependent]
      if (dependent === targetPackageName) {
        return path
      }

      visited.push(dependent)
      queue.push({ current: dependent, path })
    }
  }

  return undefined
}

const buildDependencyPaths = (
  dependencyGraph: DependencyGraph,
  packages: readonly Package[],
  targetPackage: Package,
  impactedPackages: readonly Package[],
): readonly ExplanationDependencyPath[] => {
  const dependencyPaths: ExplanationDependencyPath[] = []

  for (const impactedPackage of impactedPackages) {
    const path = findPathBetweenPackages(
      dependencyGraph,
      impactedPackage.name.moniker,
      targetPackage.name.moniker,
    )

    if (!path) continue

    const pathPackages = path
      .map((packageName) => packages.find((pkg) => pkg.name.moniker === packageName))
      .filter((pkg): pkg is Package => pkg !== undefined)

    if (pathPackages.length === 0) continue

    dependencyPaths.push({
      packages: pathPackages.map(toExplainedPackage),
    })
  }

  return dependencyPaths
}

export const explain = (
  analysis: Analysis,
  options: ExplainOptions,
): Effect.Effect<PackageExplanation, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const targetPackage = resolveRequestedPackage(options.packages, options.requestedPackage)

    if (!targetPackage) {
      const availablePackages = options.packages
        .flatMap((pkg) => [pkg.name.moniker, pkg.scope])
        .sort()
      return {
        decision: 'missing',
        requestedPackage: options.requestedPackage,
        availablePackages,
      } satisfies MissingExplanation
    }

    const primaryImpact = analysis.impacts.find(
      (impact) => impact.package.name.moniker === targetPackage.name.moniker,
    )
    if (primaryImpact) {
      return {
        decision: 'primary',
        requestedPackage: options.requestedPackage,
        package: toExplainedPackage(targetPackage),
        currentVersion: toVersionString(primaryImpact.currentVersion),
        nextOfficialVersion: Semver.toString(
          calculateNextVersion(primaryImpact.currentVersion, primaryImpact.bump),
        ),
        bump: primaryImpact.bump,
        commits: primaryImpact.commits,
      } satisfies PrimaryExplanation
    }

    const cascadeImpact = analysis.cascades.find(
      (impact) => impact.package.name.moniker === targetPackage.name.moniker,
    )
    if (cascadeImpact) {
      const dependencyGraph = yield* buildDependencyGraph([...options.packages])
      const impactedPackages = analysis.impacts.map((impact) => impact.package)
      const dependencyPaths = buildDependencyPaths(
        dependencyGraph,
        options.packages,
        targetPackage,
        impactedPackages,
      )
      const triggeredByFromPaths: ExplainedPackage[] = []
      for (const path of dependencyPaths) {
        const triggeredPackage = path.packages[0]
        if (!triggeredPackage) continue
        if (triggeredByFromPaths.some((pkg) => pkg.name === triggeredPackage.name)) continue
        triggeredByFromPaths.push(triggeredPackage)
      }
      const triggeredBy =
        dependencyPaths.length > 0
          ? triggeredByFromPaths
          : cascadeImpact.triggeredBy.map(toExplainedPackage)

      return {
        decision: 'cascade',
        requestedPackage: options.requestedPackage,
        package: toExplainedPackage(targetPackage),
        currentVersion: toVersionString(cascadeImpact.currentVersion),
        nextOfficialVersion: Semver.toString(
          calculateNextVersion(cascadeImpact.currentVersion, 'patch'),
        ),
        bump: 'patch',
        triggeredBy,
        dependencyPaths,
      } satisfies CascadeExplanation
    }

    return {
      decision: 'unchanged',
      requestedPackage: options.requestedPackage,
      package: toExplainedPackage(targetPackage),
      currentVersion: toVersionString(findLatestTagVersion(targetPackage.name, [...analysis.tags])),
      nextOfficialVersion: null,
    } satisfies UnchangedExplanation
  })
