import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'monorepo', 'pnpm'] as const

/**
 * pnpm-workspace.yaml was not found in the directory hierarchy.
 */
export const ConfigNotFoundError = Err.TaggedContextualError(
  'PnpmConfigNotFoundError',
  baseTags,
  {
    context: S.Struct({
      /** Starting directory for the search */
      searchPath: S.String,
    }),
    message: (ctx) => `pnpm-workspace.yaml not found (searched from ${ctx.searchPath})`,
  },
)

export type ConfigNotFoundError = InstanceType<typeof ConfigNotFoundError>

/**
 * Failed to parse pnpm-workspace.yaml as valid YAML.
 */
export const YamlParseError = Err.TaggedContextualError('PnpmYamlParseError', baseTags, {
  context: S.Struct({
    /** Path to the config file */
    path: S.String,
  }),
  message: (ctx) => `Failed to parse YAML: ${ctx.path}`,
  cause: S.instanceOf(Error),
})

export type YamlParseError = InstanceType<typeof YamlParseError>

/**
 * Failed to validate the parsed YAML against the Config schema.
 */
export const ConfigValidationError = Err.TaggedContextualError(
  'PnpmConfigValidationError',
  baseTags,
  {
    context: S.Struct({
      /** Path to the config file */
      path: S.String,
      /** Validation error detail */
      detail: S.String,
    }),
    message: (ctx) => `Invalid pnpm-workspace.yaml at ${ctx.path}: ${ctx.detail}`,
  },
)

export type ConfigValidationError = InstanceType<typeof ConfigValidationError>

/**
 * Failed to expand glob patterns to directories.
 */
export const GlobError = Err.TaggedContextualError('PnpmGlobError', baseTags, {
  context: S.Struct({
    /** The glob pattern that failed */
    pattern: S.String,
  }),
  message: (ctx) => `Failed to expand glob pattern: ${ctx.pattern}`,
  cause: S.instanceOf(Error),
})

export type GlobError = InstanceType<typeof GlobError>

/** Union of all errors from this module */
export type All = ConfigNotFoundError | YamlParseError | ConfigValidationError | GlobError
