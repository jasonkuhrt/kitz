import { Env } from '@kitz/env'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { loadExecutableCommandPlan } from './plan-file.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

export const reconcile = Command.make(
  'reconcile',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
    explain: Flag.boolean('explain').pipe(
      Flag.withDescription('Print decision evidence'),
      Flag.withDefault(false),
    ),
  },
  ({ from, explain }) =>
    Effect.gen(function* () {
      const { plan } = yield* loadExecutableCommandPlan(from)

      const decision = yield* Api.Reconciler.reconcile(plan)
      yield* Console.log(`Reconcile result: ${decision.classification}`)
      yield* Console.log(`Plan digest: ${decision.planDigest.value}`)
      if (explain) {
        yield* Console.log('Decision rows:')
        for (const row of decision.stateDiff) yield* Console.log(`  ${row}`)
        yield* Console.log(`Next command: ${decision.nextCommand}`)
      }
    }),
).pipe(
  Command.withDescription('Reconcile remote release state with the frozen plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer)),
)
