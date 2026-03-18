import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Conf } from '@kitz/conf'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Schema } from 'effect'
import * as LintConfig from './lint/models/config.js'
import {
  defaultOperator,
  Operator,
  type ResolveError as OperatorResolveError,
  ResolvedOperator,
  resolve as resolveOperator,
} from './operator.js'
import { defaultPublishing, Publishing } from './publishing.js'

/**
 * Release configuration schema (input from file).
 */
export class Config extends Schema.Class<Config>('Config')({
  /** Main branch name (default: 'main') */
  trunk: Schema.String.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => 'main'),
  ),
  /** Dist-tag for official releases (default: 'latest') */
  npmTag: Schema.String.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => 'latest'),
  ),
  /** Dist-tag for candidate releases (default: 'next') */
  candidateTag: Schema.String.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => 'next'),
  ),
  /** Scope to package name mapping (auto-scanned if not provided) */
  packages: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => ({}) as Record<string, string>),
  ),
  /** Declares how each lifecycle is published. */
  publishing: Publishing.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => ({})),
  ),
  /** Operator-facing command surface for local guidance and runbooks. */
  operator: Operator.pipe(Schema.optionalKey, Schema.withDecodingDefaultKey(defaultOperator)),
  /** Lint configuration */
  lint: Schema.optional(LintConfig.Config),
}) {
  static is = Schema.is(Config)
  static decode = Schema.decode(Config)
  static decodeSync = Schema.decodeSync(Config)
  static encode = Schema.encode(Config)
  static encodeSync = Schema.encodeSync(Config)
  static equivalence = Schema.equivalence(Config)
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Resolved release configuration schema (after merging and resolution).
 */
export class ResolvedConfig extends Schema.Class<ResolvedConfig>('ResolvedConfig')({
  trunk: Schema.String,
  npmTag: Schema.String,
  candidateTag: Schema.String,
  packages: Schema.Record(Schema.String, Schema.String),
  publishing: Publishing,
  operator: ResolvedOperator,
  lint: LintConfig.ResolvedConfig,
}) {
  static is = Schema.is(ResolvedConfig)
  static decode = Schema.decode(ResolvedConfig)
  static decodeSync = Schema.decodeSync(ResolvedConfig)
  static encode = Schema.encode(ResolvedConfig)
  static encodeSync = Schema.encodeSync(ResolvedConfig)
  static equivalence = Schema.equivalence(ResolvedConfig)
  static ordered = false as const
  static make = this.makeUnsafe
}

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
 *   publishing: {
 *     official: { mode: 'manual' },
 *     candidate: { mode: 'manual' },
 *     ephemeral: { mode: 'manual' },
 *   },
 *   operator: {
 *     releaseScript: 'release',
 *     prepareScripts: [],
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
export type ConfigError = Conf.File.LoadError | OperatorResolveError

/**
 * Call-site overrides for config loading.
 * Derived from schema types - any field can be overridden.
 */
export type LoadOptions = Partial<Omit<typeof Config.Type, 'lint'>> & {
  readonly lint?: Partial<typeof LintConfig.Config.Type>
}

/**
 * Load and resolve configuration from release.config.ts.
 *
 * Loads file config, merges call-site overrides, and resolves all sections.
 * Returns fully resolved config ready for use.
 *
 * @param options - Optional call-site overrides per field
 */
export const load = (
  options?: LoadOptions,
): Effect.Effect<ResolvedConfig, ConfigError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fileConfig = yield* Conf.File.load(ConfigFile, Fs.Path.toString(env.cwd))

    // Merge call-site overrides with file config (overrides replace per-field)
    const operator = yield* resolveOperator(
      options?.operator ?? fileConfig.operator ?? defaultOperator(),
    )

    return ResolvedConfig.make({
      trunk: options?.trunk ?? fileConfig.trunk ?? 'main',
      npmTag: options?.npmTag ?? fileConfig.npmTag ?? 'latest',
      candidateTag: options?.candidateTag ?? fileConfig.candidateTag ?? 'next',
      packages: options?.packages ?? fileConfig.packages ?? {},
      publishing: options?.publishing ?? fileConfig.publishing ?? defaultPublishing(),
      operator,
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

export interface InitOptions {
  readonly directory?: Fs.Path.AbsDir
  readonly force?: boolean
}

/**
 * Initialize a release.config.ts file in the target directory.
 *
 * Creates a minimal config file that imports defineConfig and exports
 * an empty config object. Since all fields have defaults, the generated
 * file is valid as-is.
 *
 * Returns a tagged union indicating whether the file was created or already existed.
 *
 * @param options - Init options (directory and force overwrite)
 */
export const init = (
  options?: InitOptions,
): Effect.Effect<InitResult, PlatformError, FileSystem.FileSystem | Env.Env> =>
  Conf.File.init(ConfigFile, {
    defineConfigImport: {
      specifier: '@kitz/release',
      namedExport: 'defineConfig',
    },
    ...(options?.directory && { directory: options.directory }),
    ...(options?.force && { force: options.force }),
  })
