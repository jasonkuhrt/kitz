import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Print the repair action for a reconciled release plan')
  .parameter(
    'from f',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Read the release plan from a specific file path' }),
    ),
  )
  .parameter(
    'yes',
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((v) => v ?? false),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(
        Schema.annotate({ description: 'Acknowledge the printed repair action', default: false }),
      ),
  )
  .parse()

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const planPath = args.from !== undefined ? Fs.Path.fromString(args.from) : undefined
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
    if (!args.yes && decision.classification !== 'clean') {
      yield* Console.log('Re-run with --yes after reviewing the reconciliation evidence.')
    }
  }),
)
