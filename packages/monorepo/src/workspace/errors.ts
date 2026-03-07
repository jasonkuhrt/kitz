import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'monorepo', 'workspace'] as const
const ConfigNotFoundErrorContext = S.Struct({
  /** Starting directory for the search. */
  searchPath: S.String,
})
const ErrorCause = S.instanceOf(Error)
const GlobErrorContext = S.Struct({
  /** The glob pattern that failed. */
  pattern: S.String,
})

/**
 * A package.json with a workspaces declaration was not found in the directory hierarchy.
 */
export const ConfigNotFoundError: Err.TaggedContextualErrorClass<
  'WorkspaceConfigNotFoundError',
  typeof baseTags,
  typeof ConfigNotFoundErrorContext,
  undefined
> = Err.TaggedContextualError('WorkspaceConfigNotFoundError', baseTags, {
  context: ConfigNotFoundErrorContext,
  message: (ctx) => `package.json with workspaces not found (searched from ${ctx.searchPath})`,
})

export type ConfigNotFoundError = InstanceType<typeof ConfigNotFoundError>

/**
 * Failed to expand workspace glob patterns to directories.
 */
export const GlobError: Err.TaggedContextualErrorClass<
  'WorkspaceGlobError',
  typeof baseTags,
  typeof GlobErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('WorkspaceGlobError', baseTags, {
  context: GlobErrorContext,
  message: (ctx) => `Failed to expand glob pattern: ${ctx.pattern}`,
  cause: ErrorCause,
})

export type GlobError = InstanceType<typeof GlobError>

/** Union of all errors from this module. */
export type All = ConfigNotFoundError | GlobError
