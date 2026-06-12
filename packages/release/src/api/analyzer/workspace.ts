import { PlatformError, FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Monorepo } from '@kitz/monorepo'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Result } from 'effect'
import { PackageResolutionError } from './errors.js'
import { PackageLocation } from './package-location.js'

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
 * Explicit package config entry for nonstandard workspace layouts.
 */
export interface PackageConfigEntry {
  /** Full package name from package.json */
  readonly name: string
  /** Optional repo-relative package directory */
  readonly path?: string | undefined
}

/**
 * Scope to package config mapping.
 *
 * Entries may be a package name string or a structured `{ name, path }`
 * object when the package lives outside the default `packages/<scope>/`
 * layout.
 */
export type PackageMap = Record<string, string | PackageConfigEntry>

const resolveConfiguredName = (entry: string | PackageConfigEntry): string =>
  typeof entry === 'string' ? entry : entry.name

const normalizeConfiguredPath = (path: string): Fs.Path.RelDir => {
  const trimmed = path.trim().replace(/\\/gu, '/')
  const withLeadingDot =
    trimmed.startsWith('./') || trimmed.startsWith('../') ? trimmed : `./${trimmed}`
  const withTrailingSlash = withLeadingDot.endsWith('/') ? withLeadingDot : `${withLeadingDot}/`
  return Fs.Path.RelDir.fromString(withTrailingSlash)
}

const inferConfiguredPackage = (
  cwd: Fs.Path.AbsDir,
  scope: string,
  entry: string | PackageConfigEntry,
): Result.Result<Package, PackageResolutionError> => {
  const name = resolveConfiguredName(entry)
  const path =
    typeof entry === 'string' || entry.path === undefined
      ? Result.succeed(PackageLocation.inferDefault(cwd, scope).path)
      : Result.match(
          PackageLocation.fromAbsolutePath(
            cwd,
            Fs.Path.join(cwd, normalizeConfiguredPath(entry.path)),
          ),
          {
            onSuccess: (location) => Result.succeed(location.path),
            onFailure: (error) =>
              Result.fail(
                new PackageResolutionError({
                  context: {
                    scope,
                    packageName: name,
                    detail: `Configured path for scope "${scope}" cannot be resolved: ${error.message}`,
                  },
                  cause: error,
                }),
              ),
          },
        )

  return Result.map(path, (resolvedPath) => ({
    scope,
    name: Pkg.Moniker.parse(name),
    path: resolvedPath,
  }))
}

/**
 * Error type for scan operation.
 */
export type ScanError =
  | Monorepo.Workspace.Errors.ConfigNotFoundError
  | Monorepo.Workspace.Errors.GlobError
  | PlatformError.PlatformError
  | Resource.ResourceError

export type ResolvePackagesError = ScanError | PackageResolutionError

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
export const toPackageMap = (packages: readonly Package[]): PackageMap =>
  Object.fromEntries(packages.map((pkg) => [pkg.scope, pkg.name.moniker]))

/**
 * Resolve config packages with scan fallback.
 *
 * If config.packages is empty, auto-scans packages.
 * Otherwise uses the config values directly.
 */
export const resolvePackages = (
  configPackages: PackageMap,
): Effect.Effect<Package[], ResolvePackagesError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    if (Object.keys(configPackages).length === 0) {
      return yield* scan
    }

    const env = yield* Env.Env
    const configuredEntries = Object.entries(configPackages)
    const entriesNeedingDiscovery = configuredEntries.filter(
      ([, entry]) => typeof entry === 'string' || entry.path === undefined,
    )

    if (entriesNeedingDiscovery.length === 0) {
      const packages: Package[] = []
      for (const [scope, entry] of configuredEntries) {
        packages.push(yield* Effect.fromResult(inferConfiguredPackage(env.cwd, scope, entry)))
      }
      return packages
    }

    const discoveredPackages = yield* scan
    const discoveredByName = Object.fromEntries(
      discoveredPackages.map((pkg): [string, Package] => [pkg.name.moniker, pkg]),
    ) as Record<string, Package>

    const unresolvedEntry = configuredEntries.find(([_, entry]) => {
      if (typeof entry !== 'string' && entry.path !== undefined) {
        return false
      }

      return discoveredByName[resolveConfiguredName(entry)] === undefined
    })
    if (unresolvedEntry) {
      const [scope, entry] = unresolvedEntry
      const packageName = resolveConfiguredName(entry)
      return yield* Effect.fail(
        new PackageResolutionError({
          context: {
            scope,
            packageName,
            detail:
              `Configured package "${packageName}" for scope "${scope}" was not found in workspace discovery. ` +
              'Add an explicit `path` in `config.packages` or update the package name to match the workspace manifest.',
          },
        }),
      )
    }

    const resolved: Package[] = []
    for (const [scope, entry] of configuredEntries) {
      if (typeof entry !== 'string' && entry.path !== undefined) {
        resolved.push(yield* Effect.fromResult(inferConfiguredPackage(env.cwd, scope, entry)))
        continue
      }

      const name = resolveConfiguredName(entry)
      const matched = discoveredByName[name]
      resolved.push(
        matched
          ? {
              scope,
              name: matched.name,
              path: matched.path,
            }
          : yield* Effect.fromResult(inferConfiguredPackage(env.cwd, scope, entry)),
      )
    }
    return resolved
  })
