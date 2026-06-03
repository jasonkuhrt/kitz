import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

export const preview = Command.make(
  'preview',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
  },
  ({ from }) =>
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

      yield* Console.log(Api.Renderer.renderPlan(planState.plan))
      if (planState.plan.publishIntent) {
        yield* Console.log('')
        yield* Console.log(`Publish profile: ${planState.plan.publishIntent.profile.id}`)
        yield* Console.log(`Registry: ${planState.plan.publishIntent.registry.url}`)
        yield* Console.log(`Dist-tag: ${planState.plan.publishIntent.distTag}`)
      }
    }),
).pipe(
  Command.withDescription('Preview the frozen release plan without building artifacts'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
