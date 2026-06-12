import { PlatformError, FileSystem } from 'effect'
import { Conf } from '@kitz/conf'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import type { PackageMap } from './analyzer/workspace.js'
import * as LintConfig from './lint/models/config.js'
import {
  Operator,
  type ResolveError as OperatorResolveError,
  ResolvedOperator,
  resolve as resolveOperator,
} from './operator.js'
import { Publishing } from './publishing.js'

const PackageConfigEntrySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.optional(Schema.String),
})
const PackageMapSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, PackageConfigEntrySchema]),
)

/**
 * Conventional commit type→impact mapping.
 *
 * `null` marks a type as recognized with no release impact.
 * Non-null values mark a type as recognized and define its bump level.
 */
const CustomTypesSchema = Schema.Record(Schema.String, Schema.NullOr(Semver.BumpType))
export type CustomTypes = typeof CustomTypesSchema.Type
export type ConventionalCommitTypeImpact = Semver.BumpType | null

/**
 * Conventional commit settings.
 */
const ConventionalCommitSettingsSchema = Schema.Struct({
  types: CustomTypesSchema.pipe(
    Schema.withDecodingDefaultKey(Effect.sync(() => ({}) as CustomTypes)),
  ),
})
export type ConventionalCommitSettings = typeof ConventionalCommitSettingsSchema.Type

/**
 * Resolve the full type→impact map by merging user overrides over StandardImpact defaults.
 *
 * Entries with `null` are recognized but do not trigger releases.
 */
export const resolveConventionalCommitTypes = (
  userTypes: CustomTypes,
): Record<string, ConventionalCommitTypeImpact> => {
  const standardDefaults: Record<string, ConventionalCommitTypeImpact> = {
    feat: 'minor',
    fix: 'patch',
    docs: 'patch',
    perf: 'patch',
    style: null,
    refactor: null,
    test: null,
    build: null,
    ci: null,
    chore: null,
    revert: null,
  }

  return { ...standardDefaults, ...userTypes }
}

/**
 * A single SHA-keyed changelog-text override.
 *
 * `body` replaces the rendered changelog/notes description for the matching
 * commit and nothing else: type, scope, breaking, the computed version bump,
 * and package attribution are all derived from the commit's parsed header,
 * which the overlay never touches. `reason` is an optional free-form note
 * (a mandatory-reason audit model lands with the later semantic-override phase).
 */
const CommitOverride = Schema.Struct({
  body: Schema.String,
  reason: Schema.optional(Schema.String),
})
export type CommitOverride = typeof CommitOverride.Type

/**
 * Commit-override SHA keys: a git short (≥7) or full (40) hex prefix. A floor of
 * 7 hex characters matches git's default short SHA and keeps a tiny prefix from
 * silently matching many commits.
 */
const CommitOverrideSha = Schema.String.check(Schema.isPattern(/^[0-9a-f]{7,40}$/i))

/**
 * Map of commit SHA-prefix → changelog-text override, validated on read.
 *
 * Each body is rejected at config-load time (a hard error with non-zero exit)
 * when it is empty, spans multiple lines, or carries a breaking-change signal —
 * a leading `!`, a breaking header, or a `BREAKING CHANGE:` / `BREAKING-CHANGE:`
 * footer (see {@link ConventionalCommits.BreakingChange.hasSignal}). The
 * breaking-change guard is the deliberate seam later phases widen to admit
 * semantic overrides behind a mandatory-reason + audit model.
 */
const CommitOverridesSchema = Schema.Record(CommitOverrideSha, CommitOverride).check(
  Schema.makeFilter((overrides) => {
    const issues: Array<Schema.FilterIssue> = []
    for (const [sha, override] of Object.entries(overrides)) {
      const reject = (detail: string): void => {
        issues.push({ path: [sha, 'body'], issue: `commit override ${sha}: ${detail}` })
      }
      if (override.body.trim().length === 0) {
        reject('body must not be empty')
      } else if (override.body.includes('\n')) {
        reject('body must be a single line')
      } else if (ConventionalCommits.BreakingChange.hasSignal(override.body)) {
        reject('breaking-change content is not supported')
      }
    }
    return issues
  }),
)
export type CommitOverrides = typeof CommitOverridesSchema.Type

/**
 * Release configuration schema (input from file).
 *
 * Every default lives here on the schema (encoded keys are optional, decoded
 * values are always present) — `load` performs no second round of literal
 * fallbacks.
 */
export class Config extends Sch.Class<Config>()('Config', {
  /** Main branch name (default: 'main') */
  trunk: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => 'main'))),
  /** Dist-tag for official releases (default: 'latest') */
  npmTag: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => 'latest'))),
  /** Dist-tag for candidate releases (default: 'next') */
  candidateTag: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => 'next'))),
  /** Scope to package config mapping (auto-scanned if not provided) */
  packages: PackageMapSchema.pipe(
    Schema.withDecodingDefaultKey(Effect.sync(() => ({}) as PackageMap)),
  ),
  /** Declares how each lifecycle is published. */
  publishing: Publishing.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => ({})))),
  /** Operator-facing command surface for local guidance and runbooks. */
  operator: Operator.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => ({})))),
  /** Conventional commit settings (custom type→impact mappings). */
  conventionalCommitSettings: ConventionalCommitSettingsSchema.pipe(
    Schema.withDecodingDefaultKey(Effect.sync(() => ({}))),
  ),
  /**
   * SHA-keyed changelog-text overlays. Each entry rewrites only the rendered
   * changelog description for the matching commit; release semantics are never
   * affected. Validated on read (see {@link CommitOverridesSchema}).
   */
  commitOverrides: CommitOverridesSchema.pipe(
    Schema.withDecodingDefaultKey(Effect.sync(() => ({}) as CommitOverrides)),
  ),
  /** Lint configuration */
  lint: Schema.optional(LintConfig.Config),
}) {}

/**
 * Resolved release configuration schema (after merging and resolution).
 */
/**
 * Resolved type→impact map. Null values are recognized but do not trigger releases.
 */
const ResolvedTypesSchema = Schema.Record(Schema.String, Schema.NullOr(Semver.BumpType))

export class ResolvedConfig extends Sch.Class<ResolvedConfig>()('ResolvedConfig', {
  trunk: Schema.String,
  npmTag: Schema.String,
  candidateTag: Schema.String,
  packages: PackageMapSchema,
  publishing: Publishing,
  operator: ResolvedOperator,
  /** Resolved type→impact mapping (standard defaults merged with user customTypes). */
  resolvedConventionalCommitTypes: ResolvedTypesSchema,
  /** SHA-keyed changelog-text overlays (validated at load). */
  commitOverrides: CommitOverridesSchema,
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
 *   // Correct the rendered changelog text for a specific commit by SHA prefix.
 *   // Changelog text only — never affects type/scope/breaking/bump. A `body`
 *   // carrying a breaking-change signal is rejected at config-load time.
 *   commitOverrides: {
 *     e348957: { body: 'fix(core): correct the off-by-one in the cursor', reason: 'typo in original' },
 *   },
 *   lint: {
 *     rules: {
 *       'pr.scope.require': Severity.Warn,
 *     },
 *   },
 * })
 * ```
 */
// Identity over the ENCODED form: config files author the serialized shape
// (all keys optional); `load` decodes it, applying the schema defaults.
export const defineConfig = (config: typeof Config.Encoded): typeof Config.Encoded => config

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
    // Schema decoding is the single source of defaults: every field of
    // `fileConfig` is already defined here. Options only override defined
    // call-site values.
    const fileConfig = yield* Conf.File.load(ConfigFile, Fs.Path.toString(env.cwd))

    const operator = yield* resolveOperator(options?.operator ?? fileConfig.operator)

    const conventionalCommitSettings =
      options?.conventionalCommitSettings ?? fileConfig.conventionalCommitSettings

    return ResolvedConfig.make({
      trunk: options?.trunk ?? fileConfig.trunk,
      npmTag: options?.npmTag ?? fileConfig.npmTag,
      candidateTag: options?.candidateTag ?? fileConfig.candidateTag,
      packages: options?.packages ?? fileConfig.packages,
      publishing: options?.publishing ?? fileConfig.publishing,
      operator,
      resolvedConventionalCommitTypes: resolveConventionalCommitTypes(
        conventionalCommitSettings.types,
      ),
      commitOverrides: options?.commitOverrides ?? fileConfig.commitOverrides,
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
): Effect.Effect<InitResult, PlatformError.PlatformError, FileSystem.FileSystem | Env.Env> =>
  Conf.File.init(ConfigFile, {
    defineConfigImport: {
      specifier: '@kitz/release',
      namedExport: 'defineConfig',
    },
    ...(options?.directory && { directory: options.directory }),
    ...(options?.force && { force: options.force }),
  })
