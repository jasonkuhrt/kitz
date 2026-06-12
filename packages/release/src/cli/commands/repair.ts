import { Str } from '@kitz/core'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Reconciler from '../../api/reconciler.js'
import { ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer, fromFlag } from './_shared.js'
import { loadExecutableCommandPlan } from './plan-file.js'

export const repair = Command.make(
  'repair',
  {
    from: fromFlag,
    yes: Flag.boolean('yes').pipe(
      Flag.withDescription('Acknowledge the printed repair action'),
      Flag.withDefault(false),
    ),
  },
  ({ from, yes }) =>
    Effect.gen(function* () {
      const { plan } = yield* loadExecutableCommandPlan(from)

      const decision = yield* Reconciler.reconcile(plan)

      const b = Str.Builder()
      b`Repair classification: ${decision.classification}`
      b`Next command: ${decision.nextCommand}`
      b(
        !yes && decision.classification !== 'clean'
          ? 'Re-run with --yes after reviewing the reconciliation evidence.'
          : null,
      )
      yield* Console.log(b.render())
    }),
).pipe(
  Command.withDescription('Print the repair action for a reconciled release plan'),
  Command.provide(Layer.mergeAll(CommandBaseLayer, ChildProcessSpawnerLayer, NpmCliLayer)),
)
