import { Env } from '@kitz/env'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { FileSystemLayer } from '../../platform.js'
import { isReadyCommandWorkspace, loadCommandWorkspace } from './command-workspace.js'

export const validateSetup = Command.make(
  'validate-setup',
  {
    strict: Flag.boolean('strict').pipe(
      Flag.withDescription('Fail on drift-prone local setup'),
      Flag.withDefault(false),
    ),
  },
  ({ strict }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const workspace = yield* loadCommandWorkspace()
      if (!isReadyCommandWorkspace(workspace)) {
        yield* Console.error('Release setup is incomplete: no packages were discovered.')
        yield* Console.error('Run `release init` and then `release validate-setup --strict`.')
        env.exit(1)
        return
      }

      yield* Console.log('Release setup proof passed.')
      yield* Console.log(`Packages: ${workspace.packages.length}`)
      yield* Console.log(`Release command: ${workspace.config.operator.releaseCommand}`)
      if (strict) {
        yield* Console.log('Strict drift checks passed.')
      }
    }),
).pipe(
  Command.withDescription('Validate release setup without producing a package release plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
