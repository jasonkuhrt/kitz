import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release', 'explorer'] as const

/**
 * Error during environmental reconnaissance.
 */
export const ExplorerError = Err.TaggedContextualError(
  'ExplorerError',
  baseTags,
  {
    context: S.Struct({
      /** What specifically went wrong during exploration. */
      detail: S.String,
    }),
    message: (ctx) => `Failed to explore release environment: ${ctx.detail}`,
  },
)

export type ExplorerError = InstanceType<typeof ExplorerError>

/** Union of all errors from the explorer module. */
export type All = ExplorerError
