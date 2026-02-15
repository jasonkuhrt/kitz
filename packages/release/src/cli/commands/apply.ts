import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Fiber, Layer, Option, Schema, Stream } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release apply
 *
 * Execute the release plan. Requires plan file from 'release plan'.
 */
const args = Oak.Command.create()
  .use(EffectSchema)
  .description('Execute the release plan')
  .parameter(
    'yes y',
    Schema.transform(
      Schema.UndefinedOr(Schema.Boolean),
      Schema.Boolean,
      {
        strict: true,
        decode: (v) => v ?? false,
        encode: (v) => v,
      },
    ).pipe(
      Schema.annotations({ description: 'Skip confirmation prompt (for CI)', default: false }),
    ),
  )
  .parameter(
    'dry-run d',
    Schema.transform(
      Schema.UndefinedOr(Schema.Boolean),
      Schema.Boolean,
      {
        strict: true,
        decode: (v) => v ?? false,
        encode: (v) => v,
      },
    ).pipe(
      Schema.annotations({ description: 'Preview actions without executing', default: false }),
    ),
  )
  .parameter(
    'tag t',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'npm dist-tag (default: latest)' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function*() {
    const env = yield* Env.Env

    // Load plan file using schema-validated resource
    const planDir = Fs.Path.join(env.cwd, Api.Planner.PLAN_DIR)
    const planFileOption = yield* Api.Planner.resource.read(planDir)

    if (Option.isNone(planFileOption)) {
      yield* Console.error(`No release plan found at ${Fs.Path.toString(Api.Planner.PLAN_FILE)}`)
      yield* Console.error(`Run 'release plan <type>' first to generate a plan.`)
      return env.exit(1)
    }

    // Load config (scanning packages is no longer needed - plan has full PlannedRelease data)
    const _config = yield* Api.Config.load()

    // Plan file now stores rich PlannedRelease data directly - no conversion needed
    const plan = planFileOption.value

    // Confirmation prompt (unless --yes)
    if (!args.yes && !args.dryRun) {
      yield* Console.log(Api.Renderer.renderApplyConfirmation(plan))
      return
    }

    if (args.dryRun) {
      yield* Console.log(Api.Renderer.renderApplyDryRun(plan))
      return
    }

    const recon = yield* Api.Explorer.explore()
    const runtimeConfig = Api.Explorer.toExecutorRuntimeConfig(recon)

    // Execute with observable workflow
    const { events, execute } = yield* Api.Executor.executeObservable(plan, {
      dryRun: args.dryRun,
      ...(args.tag && { tag: args.tag }),
      github: runtimeConfig.github,
    })

    // Fork event consumer to stream status updates
    const eventFiber = yield* events.pipe(
      Stream.tap((event) => {
        const line = Api.Executor.formatLifecycleEvent(event)
        if (!line) return Effect.void
        return line.level === 'error' ? Console.error(line.message) : Console.log(line.message)
      }),
      Stream.runDrain,
      Effect.fork,
    )

    // Run workflow
    const result = yield* execute

    // Wait for events to flush
    yield* Fiber.join(eventFiber)

    yield* Console.log(Api.Renderer.renderApplyDone(result.releasedPackages.length))

    // Clean up plan file on success
    const planPath = Fs.Path.join(env.cwd, Api.Planner.PLAN_FILE)
    yield* Fs.remove(planPath)
  }),
)
