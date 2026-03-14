import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { Config } from './config.js'
import { ConfigNotFoundError, GlobError } from './errors.js'

/**
 * Package with expanded path and manifest.
 */
export interface DiscoveredPackage {
  readonly path: Fs.Path.AbsDir
  readonly manifest: Pkg.Manifest.Manifest
}

/**
 * Config with packages expanded to directory paths.
 */
export interface ExpandedConfig extends Omit<Config, 'packages'> {
  readonly packages: readonly Fs.Path.AbsDir[]
}

/**
 * Config with packages expanded and manifests loaded.
 */
export interface DiscoveredConfig extends Omit<Config, 'packages'> {
  readonly packages: readonly DiscoveredPackage[]
}

/**
 * Options for the read function.
 */
export interface ReadOptions {
  /** Expand package globs to directory paths. */
  readonly expand?: boolean
  /** Load package.json manifests for each package (requires expand). */
  readonly manifests?: boolean
  /** Include the workspace root as a package. */
  readonly includeRoot?: boolean
}

// oxfmt-ignore
type ReadResult<O extends ReadOptions | undefined> =
  O extends { manifests: true }  ? DiscoveredConfig :
  O extends { expand: true }     ? ExpandedConfig :
                                   Config

type ReadError = ConfigNotFoundError | GlobError | PlatformError | Resource.ResourceError

const toExpandedConfig = (
  _config: Config,
  packages: readonly Fs.Path.AbsDir[],
): ExpandedConfig => ({ packages })

const toDiscoveredConfig = (
  _config: Config,
  packages: readonly DiscoveredPackage[],
): DiscoveredConfig => ({ packages })

const toConfig = (workspaces: Pkg.Manifest.Manifest['workspaces']): Option.Option<Config> => {
  if (!workspaces) return Option.none()

  if (Array.isArray(workspaces)) {
    return Option.some(Config.make({ packages: workspaces }))
  }

  if ('packages' in workspaces && workspaces.packages) {
    return Option.some(Config.make({ packages: workspaces.packages }))
  }

  return Option.none()
}

/**
 * Walk up from a directory to find the nearest package.json with a workspaces declaration.
 */
const locate = (
  startDir: Fs.Path.AbsDir,
): Effect.Effect<
  Option.Option<{ readonly root: Fs.Path.AbsDir; readonly config: Config }>,
  ReadError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    let current = startDir

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const manifest = yield* Pkg.Manifest.resource.read(current)

      if (Option.isSome(manifest)) {
        const config = toConfig(manifest.value.workspaces)
        if (Option.isSome(config)) {
          return Option.some({ root: current, config: config.value })
        }
      }

      const parent = Fs.Path.up(current)
      if (parent === null) {
        return Option.none()
      }
      current = parent
    }
  })

/**
 * Expand glob patterns to absolute directory paths.
 */
const expandGlobs = (
  config: Config,
  workspaceRoot: Fs.Path.AbsDir,
  options?: { includeRoot?: boolean },
): Effect.Effect<readonly Fs.Path.AbsDir[], GlobError> =>
  Effect.gen(function* () {
    const results: Fs.Path.AbsDir[] = []

    for (const pattern of config.packages) {
      const dirs = yield* Fs.glob(pattern, {
        cwd: workspaceRoot,
        onlyDirectories: true,
        absolute: true,
      }).pipe(
        Effect.mapError(
          (error) =>
            new GlobError({
              context: { pattern },
              cause: error,
            }),
        ),
      )

      results.push(...dirs)
    }

    if (options?.includeRoot) {
      results.unshift(workspaceRoot)
    }

    return results
  })

/**
 * Load manifest for a package directory.
 */
const loadManifest = (
  path: Fs.Path.AbsDir,
): Effect.Effect<Option.Option<DiscoveredPackage>, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const manifest = yield* Pkg.Manifest.resource.read(path)
    return Option.map(manifest, (value) => ({ path, manifest: value }))
  })

/**
 * Read workspace configuration from the nearest package.json with workspaces.
 */
export const read: {
  (): Effect.Effect<Config, ReadError, FileSystem.FileSystem | Env.Env>
  <O extends ReadOptions>(
    options: O,
  ): Effect.Effect<ReadResult<O>, ReadError, FileSystem.FileSystem | Env.Env>
} = (<O extends ReadOptions>(
  options?: O,
): Effect.Effect<ReadResult<O>, ReadError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env

    const located = yield* locate(env.cwd)
    if (Option.isNone(located)) {
      return yield* Effect.fail(
        new ConfigNotFoundError({
          context: { searchPath: Fs.Path.toString(env.cwd) },
        }),
      )
    }

    const { root: workspaceRoot, config } = located.value

    if (!options?.expand) {
      return config as ReadResult<O>
    }

    const expandedPaths = yield* expandGlobs(config, workspaceRoot, options)

    if (!options?.manifests) {
      return toExpandedConfig(config, expandedPaths) as ReadResult<O>
    }

    const packageOptions = yield* Effect.all(
      expandedPaths.map((path) => loadManifest(path)),
      { concurrency: 'unbounded' },
    )
    const packages = packageOptions.filter(Option.isSome).map((pkg) => pkg.value)

    return toDiscoveredConfig(config, packages) as ReadResult<O>
  })) as any
