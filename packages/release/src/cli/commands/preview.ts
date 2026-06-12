import { Fs } from '@kitz/fs'
import { Str } from '@kitz/core'
import { Console, Effect, Option } from 'effect'
import { Command } from 'effect/unstable/cli'
import * as Renderer from '../../api/renderer/__.js'
import { CommandBaseLayer, failWith, fromFlag } from './_shared.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

export const preview = Command.make(
  'preview',
  {
    from: fromFlag,
  },
  ({ from }) =>
    Effect.gen(function* () {
      const planPath = Option.isSome(from) ? Fs.Path.fromString(from.value) : undefined
      const planState = yield* loadPlan({
        ...(planPath !== undefined ? { path: planPath } : {}),
        source: planPath === undefined ? 'active' : 'custom',
      })

      if (planState._tag === 'PlanMissing') {
        yield* failWith(...formatMissingPlanMessage(planState))
        return
      }

      if (planState._tag === 'PlanInvalid') {
        yield* failWith(...formatInvalidPlanMessage(planState))
        return
      }

      const b = Str.Builder()
      b`${Renderer.renderPlan(planState.plan)}`
      if (planState.plan.publishIntent) {
        b``
        b`Publish profile: ${planState.plan.publishIntent.profile.id}`
        b`Registry: ${planState.plan.publishIntent.registry.url}`
        b`Dist-tag: ${planState.plan.publishIntent.distTag}`
      }
      yield* Console.log(b.render())
    }),
).pipe(
  Command.withDescription('Preview the frozen release plan without building artifacts'),
  Command.provide(CommandBaseLayer),
)
