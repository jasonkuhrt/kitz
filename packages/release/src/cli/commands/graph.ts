/**
 * @module cli/commands/graph
 *
 * Render the release execution DAG for the active release plan.
 */
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Render the release execution DAG for a saved plan')
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['text', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['text', 'json']), {
          decode: SchemaGetter.transform((value) => value ?? 'text'),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'text' })),
  )
  .parameter(
    'tag t',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'npm dist-tag override used for the workflow identity' }),
    ),
  )
  .parameter(
    'from',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Read the release plan from a specific file path' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const planState = yield* args.from
      ? loadPlan({
          path: Fs.Path.fromString(args.from),
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

    const config = yield* Api.Config.load()
    const plan = planState.plan
    const publish = Api.Publishing.resolvePublishSemanticsForPlan({
      plan,
      ...(args.tag !== undefined ? { tag: args.tag } : {}),
      publishing: config.publishing,
      npmTag: config.npmTag,
      candidateTag: config.candidateTag,
    })

    const workflowGraph = yield* Api.Executor.graph(plan, {
      dryRun: false,
      tag: publish.distTag,
      publishing: config.publishing,
      trunk: config.trunk,
    })

    yield* Console.log(
      args.format === 'json'
        ? JSON.stringify(Api.Executor.toJsonGraph(workflowGraph), null, 2)
        : Api.Renderer.renderGraph(workflowGraph),
    )
  }),
)
