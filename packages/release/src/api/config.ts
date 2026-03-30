import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Conf } from '@kitz/conf'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import type { PackageMap } from './analyzer/workspace.js'
import * as LintConfig from './lint/models/config.js'
import {
  defaultOperator,
  Operator,
  type ResolveError as OperatorResolveError,
  ResolvedOperator,
  resolve as resolveOperator,
} from './operator.js'
import { defaultPublishing, Publishing } from './publishing.js'

const PackageConfigEntrySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.optional(Schema.String),
})
const PackageMapSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, PackageConfigEntrySchema]),
)

/**
 * Conventional commit type→bump mapping.
 *
 * `null` removes a standard type from the recognized set.
 * Non-null values define the bump level for that type.
 */
const CustomTypesSchema = Schema.Record(Schema.String, Schema.NullOr(Semver.BumpType))
export type CustomTypes = typeof CustomTypesSchema.Type

/**
 * Conventional commit settings.
 */
const ConventionalCommitSettingsSchema = Schema.Struct({
  types: CustomTypesSchema.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => ({}) as CustomTypes),
  ),
})
export type ConventionalCommitSettings = typeof ConventionalCommitSettingsSchema.Type

const defaultConventionalCommitSettings = (): ConventionalCommitSettings => ({
  types: {},
})

/**
 * Resolve the full type→bump map by merging user overrides over StandardImpact defaults.
 *
 * Returns only types with non-null impacts (null removes a type).
 */
export const resolveConventionalCommitTypes = (
  userTypes: CustomTypes,
): Record<string, Semver.BumpType> => {
  const standardDefaults: Record<string, Semver.BumpType> = {
    feat: 'minor',
    fix: 'patch',
    docs: 'patch',
    perf: 'patch',
  }

  const merged = { ...standardDefaults, ...userTypes }
  const result: Record<string, Semver.BumpType> = {}
  for (const [key, value] of Object.entries(merged)) {
    if (value !== null) result[key] = value
  }
  return result
}

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
  /** Scope to package config mapping (auto-scanned if not provided) */
  packages: PackageMapSchema.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => ({}) as PackageMap),
  ),
  /** Declares how each lifecycle is published. */
  publishing: Publishing.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(() => ({})),
  ),
  /** Operator-facing command surface for local guidance and runbooks. */
  operator: Operator.pipe(Schema.optionalKey, Schema.withDecodingDefaultKey(defaultOperator)),
  /** Conventional commit settings (custom type→bump mappings). */
  conventionalCommitSettings: ConventionalCommitSettingsSchema.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(defaultConventionalCommitSettings),
  ),
  /** Lint configuration */
  lint: Schema.optional(LintConfig.Config),
}) {
  static is = Schema.is(Config)
  static decode = Schema.decodeUnknownEffect(Config)
  static decodeSync = Schema.decodeUnknownSync(Config)
  static encode = Schema.encodeUnknownEffect(Config)
  static encodeSync = Schema.encodeUnknownSync(Config)
  static equivalence = Schema.toEquivalence(Config)
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Resolved release configuration schema (after merging and resolution).
 */
/**
 * Resolved type→bump map. Only types with non-null impacts (standard defaults merged with user overrides).
 */
const ResolvedTypesSchema = Schema.Record(Schema.String, Semver.BumpType)

export class ResolvedConfig extends Schema.Class<ResolvedConfig>('ResolvedConfig')({
  trunk: Schema.String,
  npmTag: Schema.String,
  candidateTag: Schema.String,
  packages: PackageMapSchema,
  publishing: Publishing,
  operator: ResolvedOperator,
  /** Resolved type→bump mapping (standard defaults merged with user customTypes, nulls removed). */
  resolvedConventionalCommitTypes: ResolvedTypesSchema,
  lint: LintConfig.ResolvedConfig,
}) {
  static is = Schema.is(ResolvedConfig)
  static decode = Schema.decodeUnknownEffect(ResolvedConfig)
  static decodeSync = Schema.decodeUnknownSync(ResolvedConfig)
  static encode = Schema.encodeUnknownEffect(ResolvedConfig)
  static encodeSync = Schema.encodeUnknownSync(ResolvedConfig)
  static equivalence = Schema.toEquivalence(ResolvedConfig)
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
 *     docs: {
 *       name: '@kitz/docs',
 *       path: './tooling/pkg-docs/',
 *     },
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
export type LoadOptions = Partial<
  Omit<typeof Config.Type, 'lint' | 'conventionalCommitSettings'>
> & {
  readonly lint?: Partial<typeof LintConfig.Config.Type>
  readonly conventionalCommitSettings?: ConventionalCommitSettings
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

    const conventionalCommitSettings =
      options?.conventionalCommitSettings ??
      fileConfig.conventionalCommitSettings ??
      defaultConventionalCommitSettings()

    return ResolvedConfig.make({
      trunk: options?.trunk ?? fileConfig.trunk ?? 'main',
      npmTag: options?.npmTag ?? fileConfig.npmTag ?? 'latest',
      candidateTag: options?.candidateTag ?? fileConfig.candidateTag ?? 'next',
      packages: options?.packages ?? fileConfig.packages ?? {},
      publishing: options?.publishing ?? fileConfig.publishing ?? defaultPublishing(),
      operator,
      resolvedConventionalCommitTypes: resolveConventionalCommitTypes(
        conventionalCommitSettings.types ?? {},
      ),
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
