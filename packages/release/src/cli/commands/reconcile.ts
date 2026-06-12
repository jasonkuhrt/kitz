import { Str } from '@kitz/core'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Reconciler from '../../api/reconciler.js'
import { ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer, fromFlag } from './_shared.js'
import { loadExecutableCommandPlan } from './plan-file.js'

export const reconcile = Command.make(
  'reconcile',
  {
    from: fromFlag,
    explain: Flag.boolean('explain').pipe(
      Flag.withDescription('Print decision evidence'),
      Flag.withDefault(false),
    ),
  },
  ({ from, explain }) =>
    Effect.gen(function* () {
      const { plan } = yield* loadExecutableCommandPlan(from)

      const decision = yield* Reconciler.reconcile(plan)
      const b = Str.Builder()
      b`Reconcile result: ${decision.classification}`
      b`Plan digest: ${decision.planDigest.value}`
      if (explain) {
        b`Decision rows:`
        for (const row of decision.stateDiff) {
          b`  ${row}`
        }
        b`Next command: ${decision.nextCommand}`
      }
      yield* Console.log(b.render())
    }),
).pipe(
  Command.withDescription('Reconcile remote release state with the frozen plan'),
  Command.provide(Layer.mergeAll(CommandBaseLayer, ChildProcessSpawnerLayer, NpmCliLayer)),
)
