import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release', 'executor'] as const

/**
 * Executor-level publish error.
 */
export const ExecutorPublishError = Err.TaggedContextualError(
  'ExecutorPublishError',
  baseTags,
  {
    context: S.Struct({
      /** Package that failed to publish */
      packageName: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Failed to publish ${ctx.packageName}: ${ctx.detail}`,
  },
)

export type ExecutorPublishError = InstanceType<typeof ExecutorPublishError>

/**
 * Executor-level tag error.
 */
export const ExecutorTagError = Err.TaggedContextualError('ExecutorTagError', baseTags, {
  context: S.Struct({
    /** Git tag that failed */
    tag: S.String,
    /** Details about the failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to create/push tag ${ctx.tag}: ${ctx.detail}`,
})

export type ExecutorTagError = InstanceType<typeof ExecutorTagError>

/**
 * Executor-level preflight error.
 */
export const ExecutorPreflightError = Err.TaggedContextualError(
  'ExecutorPreflightError',
  baseTags,
  {
    context: S.Struct({
      /** Preflight check that failed */
      check: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Preflight check '${ctx.check}' failed: ${ctx.detail}`,
  },
)

export type ExecutorPreflightError = InstanceType<typeof ExecutorPreflightError>

/**
 * Executor-level GitHub release error.
 */
export const ExecutorGHReleaseError = Err.TaggedContextualError(
  'ExecutorGHReleaseError',
  baseTags,
  {
    context: S.Struct({
      /** Git tag for the release */
      tag: S.String,
      /** Details about the failure */
      detail: S.String,
    }),
    message: (ctx) => `Failed to create GitHub release for ${ctx.tag}: ${ctx.detail}`,
  },
)

export type ExecutorGHReleaseError = InstanceType<typeof ExecutorGHReleaseError>

/**
 * Union of all executor errors.
 */
export const ExecutorError = S.Union(
  ExecutorPublishError,
  ExecutorTagError,
  ExecutorPreflightError,
  ExecutorGHReleaseError,
)

export type ExecutorError =
  | ExecutorPublishError
  | ExecutorTagError
  | ExecutorPreflightError
  | ExecutorGHReleaseError

/** Union of all executor errors */
export type All = ExecutorError
