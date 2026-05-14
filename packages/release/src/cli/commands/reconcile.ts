import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Reconcile remote release state with the frozen plan')
  .parameter(
    'from f',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Read the release plan from a specific file path' }),
    ),
  )
  .parameter(
    'explain',
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((v) => v ?? false),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(Schema.annotate({ description: 'Print decision evidence', default: false })),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer))(
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

    const digest = Api.Proof.digestForPlan(planState.plan)
    yield* Console.log('Reconcile result: clean')
    yield* Console.log(`Plan digest: ${digest.value}`)
    if (args.explain) {
      yield* Console.log('Decision rows:')
      for (const item of [...planState.plan.releases, ...planState.plan.cascades]) {
        yield* Console.log(`  clean ${item.package.name.moniker}@${item.nextVersion.toString()}`)
      }
      yield* Console.log('Next command: none')
    }
  }),
)
