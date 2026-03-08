import { Command, CommandExecutor } from '@effect/platform'
import { Effect, Layer, String as Str } from 'effect'
import {
  NpmCliError,
  pack as packCli,
  publish as publishCli,
  type PublishOptions,
  type WhoamiOptions,
} from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'

const makeService = Effect.gen(function* () {
  const executor = yield* CommandExecutor.CommandExecutor

  const whoami: NpmCliService['whoami'] = (options?: WhoamiOptions) =>
    Effect.gen(function* () {
      const args = ['whoami']
      if (options?.registry) {
        args.push('--registry', options.registry)
      }

      const command = Command.make('npm', ...args)

      const result = yield* executor.string(command).pipe(
        Effect.mapError(
          (cause) =>
            new NpmCliError({
              context: {
                operation: 'whoami',
                detail: "npm auth failed. Run 'npm login' to authenticate.",
              },
              cause: cause instanceof Error ? cause : new Error(String(cause)),
            }),
        ),
      )

      const username = Str.trim(result)

      if (!username) {
        return yield* Effect.fail(
          new NpmCliError({
            context: {
              operation: 'whoami',
              detail: 'npm whoami returned empty - check your npm authentication',
            },
            cause: new Error('npm whoami returned empty output'),
          }),
        )
      }

      return username
    })

  const pack: NpmCliService['pack'] = (options) =>
    packCli(options).pipe(Effect.provideService(CommandExecutor.CommandExecutor, executor))

  const publish: NpmCliService['publish'] = (options: PublishOptions) =>
    publishCli(options).pipe(Effect.provideService(CommandExecutor.CommandExecutor, executor))

  return { whoami, pack, publish } satisfies NpmCliService
})

/**
 * Live implementation of NpmCli that executes actual npm commands.
 *
 * Requires `CommandExecutor` from `@effect/platform`.
 */
export const NpmCliLive: Layer.Layer<NpmCli, never, CommandExecutor.CommandExecutor> = Layer.effect(
  NpmCli,
  makeService,
)
