/**
 * @module cli/commands/status
 *
 * Show durable workflow state for the active release plan.
 *
 * Reads `.release/plan.json`, derives the same workflow identity used by
 * `release apply`, and polls the durable workflow runtime for its current state.
 */
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Show durable workflow state for the active release plan')
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
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const planFileOption = yield* Api.Planner.Store.readActive

    if (Option.isNone(planFileOption)) {
      yield* Console.error(`No release plan found at ${Api.Planner.Store.activePlanDisplayPath}`)
      yield* Console.error(
        `Run 'release plan --lifecycle <official|candidate|ephemeral>' first to generate a plan.`,
      )
      return env.exit(1)
    }

    const config = yield* Api.Config.load()
    const plan = planFileOption.value
    const publish = Api.Publishing.resolvePublishSemantics({
      lifecycle: plan.lifecycle,
      ...(args.tag !== undefined ? { tag: args.tag } : {}),
      publishing: config.publishing,
      npmTag: config.npmTag,
      candidateTag: config.candidateTag,
    })

    const workflowStatus = yield* Api.Executor.status(plan, {
      tag: publish.distTag,
      publishing: config.publishing,
      trunk: config.trunk,
    }).pipe(Effect.provide(Api.Executor.makeWorkflowRuntime()))

    yield* Console.log(
      args.format === 'json'
        ? JSON.stringify(workflowStatus, null, 2)
        : Api.Executor.formatExecutionStatus(workflowStatus),
    )
  }),
)
