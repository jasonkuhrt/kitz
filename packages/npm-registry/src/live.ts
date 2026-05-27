import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Effect, Layer, String as Str } from 'effect'
import {
  NpmCliError,
  getAccessStatus as getAccessStatusCli,
  hasVersion as hasVersionCli,
  listAccessCollaborators as listAccessCollaboratorsCli,
  listAccessPackages as listAccessPackagesCli,
  observeVersion as observeVersionCli,
  pack as packCli,
  publish as publishCli,
  type AccessOptions,
  type ObserveVersionOptions,
  type PublishOptions,
  type ViewOptions,
  type WhoamiOptions,
} from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'

const makeService = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  const whoami: NpmCliService['whoami'] = (options?: WhoamiOptions) =>
    Effect.gen(function* () {
      const args = ['whoami']
      if (options?.registry) {
        args.push('--registry', options.registry)
      }

      const command = ChildProcess.make('npm', args)

      const result = yield* spawner.string(command).pipe(
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
    packCli(options).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))

  const publish: NpmCliService['publish'] = (options: PublishOptions) =>
    publishCli(options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  const hasVersion: NpmCliService['hasVersion'] = (
    packageName: string,
    version: string,
    options?: ViewOptions,
  ) =>
    hasVersionCli(packageName, version, options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  const observeVersion: NpmCliService['observeVersion'] = (
    packageName: string,
    version: string,
    options?: ObserveVersionOptions,
  ) =>
    observeVersionCli(packageName, version, options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  const listAccessPackages: NpmCliService['listAccessPackages'] = (
    userOrScope: string,
    options?: AccessOptions,
  ) =>
    listAccessPackagesCli(userOrScope, options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  const listAccessCollaborators: NpmCliService['listAccessCollaborators'] = (
    packageName: string,
    options?: AccessOptions,
  ) =>
    listAccessCollaboratorsCli(packageName, options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  const getAccessStatus: NpmCliService['getAccessStatus'] = (
    packageName: string,
    options?: AccessOptions,
  ) =>
    getAccessStatusCli(packageName, options).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    )

  return {
    whoami,
    pack,
    publish,
    hasVersion,
    observeVersion,
    listAccessPackages,
    listAccessCollaborators,
    getAccessStatus,
  } satisfies NpmCliService
})

/**
 * Live implementation of NpmCli that executes actual npm commands.
 *
 * Requires `ChildProcessSpawner` from `effect/unstable/process`.
 */
export const NpmCliLive: Layer.Layer<NpmCli, never, ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(NpmCli, makeService)
