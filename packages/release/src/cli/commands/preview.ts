import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Preview the frozen release plan without building artifacts')
  .parameter(
    'from f',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Read the release plan from a specific file path' }),
    ),
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

    yield* Console.log(Api.Renderer.renderPlan(planState.plan))
    if (planState.plan.publishIntent) {
      yield* Console.log('')
      yield* Console.log(`Publish profile: ${planState.plan.publishIntent.profile.id}`)
      yield* Console.log(`Registry: ${planState.plan.publishIntent.registry.url}`)
      yield* Console.log(`Dist-tag: ${planState.plan.publishIntent.distTag}`)
    }
  }),
)
