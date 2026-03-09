import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Option, Schema as S } from 'effect'
import * as YAML from 'yaml'
import { Config } from './config.js'
import { ConfigNotFoundError, ConfigValidationError, GlobError, YamlParseError } from './errors.js'

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

type ReadError =
  | ConfigNotFoundError
  | YamlParseError
  | ConfigValidationError
  | GlobError
  | PlatformError
  | Resource.ResourceError

const CONFIG_FILENAME = 'pnpm-workspace.yaml'

const toExpandedConfig = (config: Config, packages: readonly Fs.Path.AbsDir[]): ExpandedConfig => ({
  catalog: config.catalog,
  catalogs: config.catalogs,
  packages,
})

const toDiscoveredConfig = (
  config: Config,
  packages: readonly DiscoveredPackage[],
): DiscoveredConfig => ({
  catalog: config.catalog,
  catalogs: config.catalogs,
  packages,
})

const locate = (
  startDir: Fs.Path.AbsDir,
): Effect.Effect<Option.Option<Fs.Path.AbsFile>, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    let current = startDir

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const configPath = Fs.Path.join(current, Fs.Path.RelFile.fromString(`./${CONFIG_FILENAME}`))
      const exists = yield* fs.exists(Fs.Path.toString(configPath))

      if (exists) {
        return Option.some(configPath)
      }

      const parent = Fs.Path.up(current)
      if (parent === null) {
        return Option.none()
      }
      current = parent
    }
  })

const parseConfig = (
  content: string,
  path: Fs.Path.AbsFile,
): Effect.Effect<Config, YamlParseError | ConfigValidationError> =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => YAML.parse(content) as unknown,
      catch: (error) =>
        new YamlParseError({
          context: { path: Fs.Path.toString(path) },
          cause: error instanceof Error ? error : new Error(String(error)),
        }),
    })

    const data = parsed ?? {}

    return yield* S.decodeUnknown(Config)(data).pipe(
      Effect.mapError(
        (error) =>
          new ConfigValidationError({
            context: {
              path: Fs.Path.toString(path),
              detail: error.message,
            },
          }),
      ),
    )
  })

const expandGlobs = (
  config: Config,
  workspaceRoot: Fs.Path.AbsDir,
  options?: { includeRoot?: boolean },
): Effect.Effect<readonly Fs.Path.AbsDir[], GlobError> =>
  Effect.gen(function* () {
    const patterns = config.packages ?? []
    const results: Fs.Path.AbsDir[] = []

    for (const pattern of patterns) {
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

const loadManifest = (
  path: Fs.Path.AbsDir,
): Effect.Effect<Option.Option<DiscoveredPackage>, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const manifest = yield* Pkg.Manifest.resource.read(path)
    return Option.map(manifest, (value) => ({ path, manifest: value }))
  })

/**
 * Read pnpm-workspace.yaml with optional expansion and manifest loading.
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

    const configPathOption = yield* locate(env.cwd)
    if (Option.isNone(configPathOption)) {
      return yield* Effect.fail(
        new ConfigNotFoundError({
          context: { searchPath: Fs.Path.toString(env.cwd) },
        }),
      )
    }
    const configPath = configPathOption.value
    const workspaceRoot = Fs.Path.toDir(configPath)

    const content = yield* Fs.readString(configPath)
    const config = yield* parseConfig(content, configPath)

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
