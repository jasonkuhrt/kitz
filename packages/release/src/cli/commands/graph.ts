/**
 * @module cli/commands/graph
 *
 * Render the release execution DAG for the active release plan.
 */
import { Env } from '@kitz/env'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Executor from '../../api/executor/__.js'
import * as Renderer from '../../api/renderer/__.js'
import { FileSystemLayer } from '../../platform.js'
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
    from: Flag.string('from').pipe(
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
  },
  ({ format, tag, from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      if (Option.isSome(tag)) {
        yield* Console.error(
          'Graph uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
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
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
