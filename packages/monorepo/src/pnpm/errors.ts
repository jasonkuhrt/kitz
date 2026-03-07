import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'monorepo', 'pnpm'] as const
const ConfigNotFoundErrorContext = S.Struct({
  /** Starting directory for the search */
  searchPath: S.String,
})
const ErrorCause = S.instanceOf(Error)
const YamlParseErrorContext = S.Struct({
  /** Path to the config file */
  path: S.String,
})
const ConfigValidationErrorContext = S.Struct({
  /** Path to the config file */
  path: S.String,
  /** Validation error detail */
  detail: S.String,
})
const GlobErrorContext = S.Struct({
  /** The glob pattern that failed */
  pattern: S.String,
})

/**
 * pnpm-workspace.yaml was not found in the directory hierarchy.
 */
export const ConfigNotFoundError: Err.TaggedContextualErrorClass<
  'PnpmConfigNotFoundError',
  typeof baseTags,
  typeof ConfigNotFoundErrorContext,
  undefined
> = Err.TaggedContextualError('PnpmConfigNotFoundError', baseTags, {
  context: ConfigNotFoundErrorContext,
  message: (ctx) => `pnpm-workspace.yaml not found (searched from ${ctx.searchPath})`,
})

export type ConfigNotFoundError = InstanceType<typeof ConfigNotFoundError>

/**
 * Failed to parse pnpm-workspace.yaml as valid YAML.
 */
export const YamlParseError: Err.TaggedContextualErrorClass<
  'PnpmYamlParseError',
  typeof baseTags,
  typeof YamlParseErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('PnpmYamlParseError', baseTags, {
  context: YamlParseErrorContext,
  message: (ctx) => `Failed to parse YAML: ${ctx.path}`,
  cause: ErrorCause,
})

export type YamlParseError = InstanceType<typeof YamlParseError>

/**
 * Failed to validate the parsed YAML against the Config schema.
 */
export const ConfigValidationError: Err.TaggedContextualErrorClass<
  'PnpmConfigValidationError',
  typeof baseTags,
  typeof ConfigValidationErrorContext,
  undefined
> = Err.TaggedContextualError('PnpmConfigValidationError', baseTags, {
  context: ConfigValidationErrorContext,
  message: (ctx) => `Invalid pnpm-workspace.yaml at ${ctx.path}: ${ctx.detail}`,
})

export type ConfigValidationError = InstanceType<typeof ConfigValidationError>

/**
 * Failed to expand glob patterns to directories.
 */
export const GlobError: Err.TaggedContextualErrorClass<
  'PnpmGlobError',
  typeof baseTags,
  typeof GlobErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('PnpmGlobError', baseTags, {
  context: GlobErrorContext,
  message: (ctx) => `Failed to expand glob pattern: ${ctx.pattern}`,
  cause: ErrorCause,
})

export type GlobError = InstanceType<typeof GlobError>

/** Union of all errors from this module */
export type All = ConfigNotFoundError | YamlParseError | ConfigValidationError | GlobError
