import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'monorepo', 'pnpm'] as const
const ConfigNotFoundErrorContext = S.Struct({
  /** Starting directory for the search. */
  searchPath: S.String,
})
const ErrorCause = S.instanceOf(Error)
const GlobErrorContext = S.Struct({
  /** The glob pattern that failed. */
  pattern: S.String,
})
const ConfigValidationErrorContext = S.Struct({
  path: S.String,
  detail: S.String,
})
const YamlParseErrorContext = S.Struct({
  path: S.String,
})

/**
 * A pnpm-workspace.yaml file was not found in the directory hierarchy.
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
 * Failed to parse pnpm-workspace.yaml as YAML.
 */
export const YamlParseError: Err.TaggedContextualErrorClass<
  'PnpmYamlParseError',
  typeof baseTags,
  typeof YamlParseErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('PnpmYamlParseError', baseTags, {
  context: YamlParseErrorContext,
  message: (ctx) => `Failed to parse YAML in ${ctx.path}`,
  cause: ErrorCause,
})

export type YamlParseError = InstanceType<typeof YamlParseError>

/**
 * YAML parsed successfully but did not match the expected schema.
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
 * Failed to expand a configured workspace glob.
 */
export const GlobError: Err.TaggedContextualErrorClass<
  'PnpmGlobError',
  typeof baseTags,
  typeof GlobErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('PnpmGlobError', baseTags, {
  context: GlobErrorContext,
  message: (ctx) => `Failed to expand pnpm workspace glob: ${ctx.pattern}`,
  cause: ErrorCause,
})

export type GlobError = InstanceType<typeof GlobError>

/** Union of all errors from this module. */
export type All = ConfigNotFoundError | YamlParseError | ConfigValidationError | GlobError
