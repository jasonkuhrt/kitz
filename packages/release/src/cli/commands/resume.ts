/**
 * @module cli/commands/resume
 *
 * Resume an interrupted durable release workflow for the active release plan.
 */
import { Terminal } from 'effect'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Oak } from '@kitz/oak'
import { Console, Effect, Fiber, Layer, Option, Schema, SchemaGetter, Stream } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer, TerminalLayer } from '../../platform.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Resume an interrupted release workflow')
  .parameter(
    'yes y',
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((v) => v ?? false),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(Schema.annotate({ description: 'Skip confirmation prompt (for CI)', default: false })),
  )
  .parameter(
    'tag t',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'npm dist-tag override used for the workflow identity' }),
    ),
  )
  .parse()

const confirm = (message: string) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal
    yield* terminal.display(message)
    const answer = yield* terminal.readLine.pipe(Effect.catch(() => Effect.succeed('')))
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  })

const commandLayer = ChildProcessSpawnerLayer
const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(commandLayer))

Cli.run(
  Layer.mergeAll(Env.Live, FileSystemLayer, TerminalLayer, Git.GitLive, commandLayer, npmLayer),
)(
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

    if (workflowStatus.state !== 'suspended') {
      yield* Console.error(Api.Executor.formatExecutionStatus(workflowStatus))
      yield* Console.error('')
      yield* Console.error(
        workflowStatus.state === 'not-started'
          ? 'No interrupted workflow exists for this plan yet. Run `release apply` first.'
          : workflowStatus.state === 'succeeded'
            ? 'This release plan already completed successfully. Generate a new plan before releasing again.'
            : 'This workflow ended in a terminal failure and cannot be resumed automatically.',
      )
      return env.exit(1)
    }

    yield* Console.log(Api.Executor.formatExecutionStatus(workflowStatus))

    if (!args.yes) {
      const approved = yield* confirm('Resume interrupted release? [y/N] ')
      if (!approved) {
        yield* Console.log('Release resume canceled.')
        return env.exit(1)
      }
    }

    const runtime = yield* Api.Explorer.explore()
    const runtimeConfig = Api.Explorer.toExecutorRuntimeConfig(runtime)
    if (!runtimeConfig.github) {
      yield* Console.error('GitHub release target and token are required for release resume.')
      yield* Console.error('Set GITHUB_TOKEN and ensure origin points to GitHub, then retry.')
      return env.exit(1)
    }

    const { events, execute } = yield* Api.Executor.executeObservable(plan, {
      dryRun: false,
      tag: publish.distTag,
      publishing: config.publishing,
      trunk: config.trunk,
      github: runtimeConfig.github,
    })

    const eventFiber = yield* events.pipe(
      Stream.tap((event) => {
        const line = Api.Executor.formatLifecycleEvent(event)
        if (!line) return Effect.void
        return line.level === 'error' ? Console.error(line.message) : Console.log(line.message)
      }),
      Stream.runDrain,
      Effect.forkChild,
    )

    const result = yield* execute

    yield* Fiber.join(eventFiber)

    yield* Console.log(Api.Renderer.renderApplyDone(result.releasedPackages.length))

    yield* Api.Planner.Store.deleteActive
  }),
)
