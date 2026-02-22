import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Conf } from '@kitz/conf'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Schema } from 'effect'
import * as LintConfig from './lint/models/config.js'

/**
 * Release configuration schema (input from file).
 */
export class Config extends Schema.Class<Config>('Config')({
  /** Main branch name (default: 'main') */
  trunk: Schema.optionalWith(Schema.String, { default: () => 'main' }),
  /** Dist-tag for stable releases (default: 'latest') */
  npmTag: Schema.optionalWith(Schema.String, { default: () => 'latest' }),
  /** Dist-tag for preview releases (default: 'next') */
  previewTag: Schema.optionalWith(Schema.String, { default: () => 'next' }),
  /** Skip npm publish (dry run) */
  skipNpm: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Scope to package name mapping (auto-scanned if not provided) */
  packages: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) },
  ),
  /** Lint configuration */
  lint: Schema.optional(LintConfig.Config),
}) {}

/**
 * Resolved release configuration schema (after merging and resolution).
 */
export class ResolvedConfig extends Schema.Class<ResolvedConfig>('ResolvedConfig')({
  trunk: Schema.String,
  npmTag: Schema.String,
  previewTag: Schema.String,
  skipNpm: Schema.Boolean,
  packages: Schema.Record({ key: Schema.String, value: Schema.String }),
  lint: LintConfig.ResolvedConfig,
}) {}

/**
 * Config file definition for @kitz/release.
 */
const ConfigFile = Conf.File.define({
  name: 'release',
  schema: Config,
})

/**
 * Define release configuration with type safety.
 *
 * @example
 * ```ts
 * // release.config.ts
 * import { defineConfig, Severity } from '@kitz/release'
 *
 * export default defineConfig({
 *   trunk: 'main',
 *   packages: {
 *     core: '@kitz/core',
 *     kitz: 'kitz',
 *   },
 *   lint: {
 *     rules: {
 *       'pr.scope.require': Severity.Warn,
 *     },
 *   },
 * })
 * ```
 */
export const defineConfig = Conf.File.createDefineConfig(ConfigFile)

/**
 * Error types from config loading.
 */
export type ConfigError = Conf.File.LoadError

/**
 * CLI overrides for config loading.
 * Derived from schema types - any field can be overridden.
 */
export type LoadOptions =
  & Partial<Omit<typeof Config.Type, 'lint'>>
  & { readonly lint?: Partial<typeof LintConfig.Config.Type> }

/**
 * Load and resolve configuration from release.config.ts.
 *
 * Loads file config, merges CLI overrides, and resolves all sections.
 * Returns fully resolved config ready for use.
 *
 * @param options - Optional CLI overrides per field
 */
export const load = (
  options?: LoadOptions,
): Effect.Effect<
  ResolvedConfig,
  ConfigError,
  FileSystem.FileSystem | Env.Env
> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const fileConfig = yield* Conf.File.load(ConfigFile, Fs.Path.toString(env.cwd))

    // Merge CLI overrides with file config (CLI replaces per-field)
    return ResolvedConfig.make({
      trunk: options?.trunk ?? fileConfig.trunk,
      npmTag: options?.npmTag ?? fileConfig.npmTag,
      previewTag: options?.previewTag ?? fileConfig.previewTag,
      skipNpm: options?.skipNpm ?? fileConfig.skipNpm,
      packages: options?.packages ?? fileConfig.packages,
      lint: LintConfig.resolveConfig({
        defaults: options?.lint?.defaults ?? fileConfig.lint?.defaults,
        rules: options?.lint?.rules ?? fileConfig.lint?.rules,
        onlyRules: options?.lint?.onlyRules ?? fileConfig.lint?.onlyRules,
        skipRules: options?.lint?.skipRules ?? fileConfig.lint?.skipRules,
      }),
    })
  })

/**
 * Result of config initialization.
 */
export type InitResult = Conf.File.InitResult

/**
 * Initialize a release.config.ts file in the target directory.
 *
 * Creates a minimal config file that imports defineConfig and exports
 * an empty config object. Since all fields have defaults, the generated
 * file is valid as-is.
 *
 * Returns a tagged union indicating whether the file was created or already existed.
 *
 * @param directory - Target directory (defaults to Env.cwd)
 */
export const init = (
  directory?: Fs.Path.AbsDir,
): Effect.Effect<InitResult, PlatformError, FileSystem.FileSystem | Env.Env> =>
  Conf.File.init(ConfigFile, {
    defineConfigImport: {
      specifier: '@kitz/release',
      namedExport: 'defineConfig',
    },
    ...(directory && { directory }),
  })
