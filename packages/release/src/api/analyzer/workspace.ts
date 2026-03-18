import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Monorepo } from '@kitz/monorepo'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Exit } from 'effect'
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
): Package => {
  const name = resolveConfiguredName(entry)
  const explicitPath =
    typeof entry === 'string' || entry.path === undefined
      ? undefined
      : PackageLocation.fromAbsolutePath(
          cwd,
          Fs.Path.join(cwd, normalizeConfiguredPath(entry.path)),
        )
  const location = PackageLocation.inferDefault(cwd, scope)

  return {
    scope,
    name: Pkg.Moniker.parse(name),
    path: explicitPath?.path ?? location.path,
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
      return Object.entries(configPackages).map(([scope, entry]) =>
        inferConfiguredPackage(env.cwd, scope, entry),
      )
    }

    const discoveredPackages = discoveredPackagesExit.value
    const discoveredByName = Object.fromEntries(
      discoveredPackages.map((pkg): [string, Package] => [pkg.name.moniker, pkg]),
    ) as Record<string, Package>
    return Object.entries(configPackages).map(([scope, entry]) => {
      if (typeof entry !== 'string' && entry.path !== undefined) {
        return inferConfiguredPackage(env.cwd, scope, entry)
      }

      const name = resolveConfiguredName(entry)
      const matched = discoveredByName[name]
      return matched
        ? {
            scope,
            name: matched.name,
            path: matched.path,
          }
        : inferConfiguredPackage(env.cwd, scope, entry)
    })
  })
