import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

export const repair = Command.make(
  'repair',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
    yes: Flag.boolean('yes').pipe(
      Flag.withDescription('Acknowledge the printed repair action'),
      Flag.withDefault(false),
    ),
  },
  ({ from, yes }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const planPath = Option.isSome(from) ? Fs.Path.fromString(from.value) : undefined
      const planState = yield* loadPlan({
        ...(planPath !== undefined ? { path: planPath } : {}),
        source: planPath === undefined ? 'active' : 'custom',
      })

      if (planState._tag === 'PlanMissing') {
        for (const line of formatMissingPlanMessage(planState)) yield* Console.error(line)
        return env.exit(1)
      }

      if (planState._tag === 'PlanInvalid') {
        for (const line of formatInvalidPlanMessage(planState)) yield* Console.error(line)
        return env.exit(1)
      }

      const decision = yield* Api.Reconciler.reconcile(planState.plan)

      yield* Console.log(`Repair classification: ${decision.classification}`)
      yield* Console.log(`Next command: ${decision.nextCommand}`)
      if (!yes && decision.classification !== 'clean') {
        yield* Console.log('Re-run with --yes after reviewing the reconciliation evidence.')
      }
    }),
).pipe(
  Command.withDescription('Print the repair action for a reconciled release plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer)),
)
