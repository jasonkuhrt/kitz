import { Command, CommandExecutor } from '@effect/platform'
import { Fs } from '@kitz/fs'
import { Effect, Layer, String as Str } from 'effect'
import { NpmCliError, type PublishOptions, type WhoamiOptions } from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'

const makeService = Effect.gen(function*() {
  const executor = yield* CommandExecutor.CommandExecutor

  const whoami: NpmCliService['whoami'] = (options?: WhoamiOptions) =>
    Effect.gen(function*() {
      const args = ['whoami']
      if (options?.registry) {
        args.push('--registry', options.registry)
      }

      const command = Command.make('npm', ...args)

      const result = yield* executor.string(command).pipe(
        Effect.mapError((cause) =>
          new NpmCliError({
            context: {
              operation: 'whoami',
              detail: "npm auth failed. Run 'npm login' to authenticate.",
            },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          })
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
          }),
        )
      }

      return username
    })

  const publish: NpmCliService['publish'] = (options: PublishOptions) =>
    Effect.gen(function*() {
      const args = ['publish']

      // Default to public access for scoped packages
      args.push('--access', options.access ?? 'public')

      if (options.tag) {
        args.push('--tag', options.tag)
      }

      if (options.registry) {
        args.push('--registry', options.registry)
      }

      const command = Command.make('npm', ...args).pipe(
        Command.workingDirectory(Fs.Path.toString(options.cwd)),
      )

      yield* executor.exitCode(command).pipe(
        Effect.flatMap((code) => {
          if (code !== 0) {
            return Effect.fail(
              new NpmCliError({
                context: {
                  operation: 'publish',
                  detail: `npm publish exited with code ${code}`,
                },
              }),
            )
          }
          return Effect.void
        }),
        Effect.mapError((cause) => {
          if (cause instanceof NpmCliError) return cause
          return new NpmCliError({
            context: { operation: 'publish' },
            cause: cause instanceof Error ? cause : new Error(String(cause)),
          })
        }),
      )
    })

  return { whoami, publish } satisfies NpmCliService
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
