/**
 * @module cli/commands/graph
 *
 * Render the release execution DAG for the active release plan.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  formatUnsupportedExecutionPlanMessage,
  hasExecutablePlanContract,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'

export const graph = Command.make(
  'graph',
  {
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('text'),
    ),
    tag: Flag.string('tag').pipe(
      Flag.withAlias('t'),
      Flag.withDescription('npm dist-tag override used for the workflow identity'),
      Flag.optional,
    ),
    from: Flag.string('from').pipe(
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
  },
  ({ format, tag, from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const planState = yield* Option.isSome(from)
        ? loadPlan({
            path: Fs.Path.fromString(from.value),
            source: 'custom',
          })
        : loadActivePlan()

      if (planState._tag === 'PlanMissing') {
        for (const line of formatMissingPlanMessage(planState)) {
          yield* Console.error(line)
        }
        return env.exit(1)
      }

      if (planState._tag === 'PlanInvalid') {
        for (const line of formatInvalidPlanMessage(planState)) {
          yield* Console.error(line)
        }
        return env.exit(1)
      }

      const plan = planState.plan
      if (Option.isSome(tag)) {
        yield* Console.error(
          'Graph uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
      if (!hasExecutablePlanContract(plan)) {
        for (const line of formatUnsupportedExecutionPlanMessage(plan)) yield* Console.error(line)
        return env.exit(1)
      }
      const publishing = Api.Publishing.publishingFromIntent(plan.publishIntent)

      const workflowGraph = yield* Api.Executor.graph(plan, {
        dryRun: false,
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
      })

      yield* Console.log(
        format === 'json'
          ? JSON.stringify(Api.Executor.toJsonGraph(workflowGraph), null, 2)
          : Api.Renderer.renderGraph(workflowGraph),
      )
    }),
).pipe(
  Command.withDescription('Render the release execution DAG for a saved plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
