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

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Conditional return type
// ============================================================================

// dprint-ignore
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

// ============================================================================
// Internal helpers
// ============================================================================

const CONFIG_FILENAME = 'pnpm-workspace.yaml'

/**
 * Walk up from a directory to find pnpm-workspace.yaml.
 */
const locate = (
  startDir: Fs.Path.AbsDir,
): Effect.Effect<Option.Option<Fs.Path.AbsFile>, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    let current = startDir

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const configPath = Fs.Path.join(current, Fs.Path.RelFile.fromString(`./${CONFIG_FILENAME}`))
      const exists = yield* fs.exists(Fs.Path.toString(configPath))

      if (exists) {
        return Option.some(configPath)
      }

      // Try to go up one directory
      const parent = Fs.Path.up(current)
      if (parent === null) {
        // Reached root, file not found
        return Option.none()
      }
      current = parent
    }
  })

/**
 * Parse YAML content and validate against Config schema.
 */
const parseConfig = (
  content: string,
  path: Fs.Path.AbsFile,
): Effect.Effect<Config, YamlParseError | ConfigValidationError> =>
  Effect.gen(function*() {
    // Parse YAML
    const parsed = yield* Effect.try({
      try: () => YAML.parse(content) as unknown,
      catch: (error) =>
        new YamlParseError({
          context: { path: Fs.Path.toString(path) },
          cause: error instanceof Error ? error : new Error(String(error)),
        }),
    })

    // Handle empty file (YAML.parse returns null for empty content)
    const data = parsed ?? {}

    // Validate against schema
    const config = yield* S.decodeUnknown(Config)(data).pipe(
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

    return config
  })

/**
 * Expand glob patterns to absolute directory paths.
 */
const expandGlobs = (
  config: Config,
  workspaceRoot: Fs.Path.AbsDir,
  options?: { includeRoot?: boolean },
): Effect.Effect<readonly Fs.Path.AbsDir[], GlobError> =>
  Effect.gen(function*() {
    const patterns = config.packages ?? []
    const results: Fs.Path.AbsDir[] = []

    // Expand each glob pattern
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

    // Optionally include root
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
  Effect.gen(function*() {
    const manifest = yield* Pkg.Manifest.resource.read(path)
    return Option.map(manifest, (m) => ({ path, manifest: m }))
  })

// ============================================================================
// Public API
// ============================================================================

/**
 * Read pnpm-workspace.yaml with optional expansion and manifest loading.
 *
 * The return type changes based on the options provided:
 * - No options: Returns just the parsed Config
 * - `{ expand: true }`: Returns ExpandedConfig with packages as AbsDir[]
 * - `{ expand: true, manifests: true }`: Returns DiscoveredConfig with full package info
 *
 * @example
 * ```ts
 * import { Monorepo } from '@kitz/monorepo'
 *
 * // Just parse the config
 * const config = yield* Monorepo.Pnpm.read()
 *
 * // Expand globs to paths
 * const expanded = yield* Monorepo.Pnpm.read({ expand: true })
 * // expanded.packages is Fs.Path.AbsDir[]
 *
 * // Full discovery with manifests
 * const discovered = yield* Monorepo.Pnpm.read({ expand: true, manifests: true })
 * // discovered.packages is { path: AbsDir, manifest: Manifest }[]
 * ```
 */
export const read: {
  (): Effect.Effect<Config, ReadError, FileSystem.FileSystem | Env.Env>
  <O extends ReadOptions>(options: O): Effect.Effect<ReadResult<O>, ReadError, FileSystem.FileSystem | Env.Env>
} =
  (<O extends ReadOptions>(options?: O): Effect.Effect<ReadResult<O>, ReadError, FileSystem.FileSystem | Env.Env> =>
    Effect.gen(function*() {
      const env = yield* Env.Env

      // 1. Locate pnpm-workspace.yaml
      const configPathOption = yield* locate(env.cwd)
      if (Option.isNone(configPathOption)) {
        return yield* Effect.fail(
          new ConfigNotFoundError({
            context: { searchPath: Fs.Path.toString(env.cwd) },
          }),
        )
      }
      const configPath = configPathOption.value

      // Get workspace root (directory containing the config)
      const workspaceRoot = Fs.Path.toDir(configPath)

      // 2. Read and parse YAML
      const content = yield* Fs.readString(configPath)
      const config = yield* parseConfig(content, configPath)

      // 3. If not expanding, return raw config
      if (!options?.expand) {
        return config as any
      }

      // 4. Expand globs to paths
      const expandedPaths = yield* expandGlobs(config, workspaceRoot, options)

      // 5. If not loading manifests, return expanded config
      if (!options?.manifests) {
        return {
          ...config,
          packages: expandedPaths,
        } as any
      }

      // 6. Load manifests for each package
      const packageOptions = yield* Effect.all(expandedPaths.map((path) => loadManifest(path)), {
        concurrency: 'unbounded',
      })
      const packages = packageOptions.filter(Option.isSome).map((pkg) => pkg.value)

      return {
        ...config,
        packages,
      } as any
    })) as any
