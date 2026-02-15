import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release'] as const

/**
 * Error during release process.
 */
export const ReleaseError = Err.TaggedContextualError('ReleaseError', baseTags, {
  context: S.Struct({
    operation: S.Literal('plan', 'apply', 'tag'),
    detail: S.optional(S.String),
  }),
  message: (ctx) =>
    ctx.detail ? `Failed to ${ctx.operation} release: ${ctx.detail}` : `Failed to ${ctx.operation} release`,
})

export type ReleaseError = InstanceType<typeof ReleaseError>
