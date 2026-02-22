import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Monorepo } from '@kitz/monorepo'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'

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

/**
 * Error type for scan operation.
 */
export type ScanError =
  | Monorepo.Pnpm.Errors.ConfigNotFoundError
  | Monorepo.Pnpm.Errors.YamlParseError
  | Monorepo.Pnpm.Errors.ConfigValidationError
  | Monorepo.Pnpm.Errors.GlobError
  | PlatformError
  | Resource.ResourceError

/**
 * Scan packages in the monorepo using pnpm-workspace.yaml.
 *
 * Uses {@link Monorepo.Pnpm.read} to discover packages from the workspace
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
export const scan: Effect.Effect<
  Package[],
  ScanError,
  FileSystem.FileSystem | Env.Env
> = Effect.gen(function*() {
  const discovered = yield* Monorepo.Pnpm.read({ expand: true, manifests: true })

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
  Effect.gen(function*() {
    // If config explicitly provides packages, use those
    if (Object.keys(configPackages).length > 0) {
      const env = yield* Env.Env
      const packagesDir = Fs.Path.join(env.cwd, packagesRelDir)

      return Object.entries(configPackages).map(([scope, name]) => {
        const scopeRelDir = Fs.Path.RelDir.fromString(`./${scope}/`)
        const scopeDir = Fs.Path.join(packagesDir, scopeRelDir)
        return {
          scope,
          name: Pkg.Moniker.parse(name),
          path: scopeDir,
        }
      })
    }

    // Otherwise scan from filesystem
    return yield* scan
  })
