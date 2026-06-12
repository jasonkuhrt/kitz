import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Effect, FileSystem } from 'effect'
import * as Journal from '../../journal.js'
import type { ReleasePayloadType } from './payload.js'

export const recordSideEffect = <E, R>(params: {
  readonly payload: ReleasePayloadType
  readonly kind: Journal.SideEffectInput['kind']
  readonly subject: string
  readonly planned: Readonly<Record<string, unknown>>
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- side-effect recording preserves the wrapped operation's native error channel.
  readonly effect: Effect.Effect<string, E, R>
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- side-effect recording preserves the wrapped operation's native error channel.
}): Effect.Effect<string, E, R | Env.Env | FileSystem.FileSystem> => {
  if (params.payload.options.dryRun || params.payload.options.planDigest === undefined) {
    return params.effect
  }

  return Effect.gen(function* () {
    yield* Journal.appendSideEffect({
      planDigest: params.payload.options.planDigest!,
      kind: params.kind,
      subject: params.subject,
      planned: params.planned,
      result: 'attempting',
    }).pipe(Effect.orDie)
    return yield* params.effect.pipe(
      Effect.tap(() =>
        Journal.appendSideEffect({
          planDigest: params.payload.options.planDigest!,
          kind: params.kind,
          subject: params.subject,
          planned: params.planned,
          result: 'succeeded',
        }).pipe(Effect.orDie),
      ),
      Effect.tapError((error) =>
        Journal.appendSideEffect({
          planDigest: params.payload.options.planDigest!,
          kind: params.kind,
          subject: params.subject,
          planned: {
            ...params.planned,
            error: Err.ensure(error).message,
          },
          result: 'failed',
        }).pipe(Effect.orDie),
      ),
    )
  })
}
