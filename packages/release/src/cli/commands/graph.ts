/**
 * @module cli/commands/graph
 *
 * Render the release execution DAG for the active release plan.
 */
import { Console, Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Executor from '../../api/executor/__.js'
import * as Renderer from '../../api/renderer/__.js'
import { CommandBaseLayer, fromFlagNoAlias, rejectFrozenTag } from './_shared.js'
import { loadExecutableCommandPlan } from './plan-file.js'

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
    from: fromFlagNoAlias,
  },
  ({ format, tag, from }) =>
    Effect.gen(function* () {
      yield* rejectFrozenTag(tag)
      const { plan, publishing } = yield* loadExecutableCommandPlan(from)

      const workflowGraph = yield* Executor.graph(plan, {
        dryRun: false,
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
      })

      yield* Console.log(
        format === 'json'
          ? JSON.stringify(Executor.toJsonGraph(workflowGraph), null, 2)
          : Renderer.renderGraph(workflowGraph),
      )
    }),
).pipe(
  Command.withDescription('Render the release execution DAG for a saved plan'),
  Command.provide(CommandBaseLayer),
)
