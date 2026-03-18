import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Monorepo } from '@kitz/monorepo'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Exit } from 'effect'

/**
 * A scanned package in the monorepo.
 */
export interface Package {
  /** Directory name (used as scope in commits) */
  readonly scope: string
  /** Full package name from package.json */
  readonly name: Pkg.Moniker.Moniker
  /** Absolute path to package directory */
  readonly path: Fs.Path.AbsDir
}

/**
 * Scope to package name mapping.
 */
export type PackageMap = Record<string, string>

// Shared typed path for packages directory
const packagesRelDir = Fs.Path.RelDir.fromString('./packages/')

const inferConfiguredPackage = (cwd: Fs.Path.AbsDir, scope: string, name: string): Package => {
  const packagesDir = Fs.Path.join(cwd, packagesRelDir)
  const scopeRelDir = Fs.Path.RelDir.fromString(`./${scope}/`)
  const scopeDir = Fs.Path.join(packagesDir, scopeRelDir)

  return {
    scope,
    name: Pkg.Moniker.parse(name),
    path: scopeDir,
  }
}

/**
 * Error type for scan operation.
 */
export type ScanError =
  | Monorepo.Workspace.Errors.ConfigNotFoundError
  | Monorepo.Workspace.Errors.GlobError
  | PlatformError
  | Resource.ResourceError

/**
 * Scan packages in the monorepo using the root package.json workspaces field.
 *
 * Uses {@link Monorepo.Workspace.read} to discover packages from the workspace
 * configuration and builds a scope-to-package mapping.
 *
 * @example
 * ```ts
 * const packages = await Effect.runPromise(
 *   Effect.provide(scan, Layer.mergeAll(Env.Live, NodeFileSystem.layer))
 * )
 * // [{ scope: 'core', name: '@kitz/core', path: AbsDir('/path/to/repo/packages/core/') }]
 * ```
 */
export const scan: Effect.Effect<Package[], ScanError, FileSystem.FileSystem | Env.Env> =
  Effect.gen(function* () {
    const discovered = yield* Monorepo.Workspace.read({ expand: true, manifests: true })

    return discovered.packages
      .filter((pkg) => {
        // Exclude packages without a proper name
        const name = pkg.manifest.name
        return !(Pkg.Moniker.isUnscoped(name) && name.name === 'unnamed')
      })
      .map((pkg) => ({
        scope: Fs.Path.name(pkg.path),
        name: pkg.manifest.name,
        path: pkg.path,
      }))
  })

/**
 * Build a scope-to-package-name map from scanned packages.
 *
 * @example
 * ```ts
 * const map = toPackageMap(packages)
 * // { core: '@kitz/core', kitz: 'kitz' }
 * ```
 */
export const toPackageMap = (packages: Package[]): PackageMap => {
  const map: PackageMap = {}
  for (const pkg of packages) {
    map[pkg.scope] = pkg.name.moniker
  }
  return map
}

/**
 * Resolve config packages with scan fallback.
 *
 * If config.packages is empty, auto-scans packages.
 * Otherwise uses the config values directly.
 */
export const resolvePackages = (
  configPackages: PackageMap,
): Effect.Effect<Package[], ScanError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    if (Object.keys(configPackages).length === 0) {
      return yield* scan
    }

    const env = yield* Env.Env
    const discoveredPackagesExit = yield* Effect.exit(scan)

    if (Exit.isFailure(discoveredPackagesExit)) {
      return Object.entries(configPackages).map(([scope, name]) =>
        inferConfiguredPackage(env.cwd, scope, name),
      )
    }

    const discoveredPackages = discoveredPackagesExit.value
    const discoveredByName = Object.fromEntries(
      discoveredPackages.map((pkg): [string, Package] => [pkg.name.moniker, pkg]),
    ) as Record<string, Package>
    return Object.entries(configPackages).map(([scope, name]) => {
      const matched = discoveredByName[name]
      return matched
        ? {
            scope,
            name: matched.name,
            path: matched.path,
          }
        : inferConfiguredPackage(env.cwd, scope, name)
    })
  })
