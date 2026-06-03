import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

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
