/**
 * @module cli/commands/resume
 *
 * Resume an interrupted durable release workflow for the active release plan.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Fiber, Layer, Option, Stream, Terminal } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer, TerminalLayer } from '../../platform.js'
import { formatPlanCommand, loadExecutableCommandPlan } from './plan-file.js'

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

export const resume = Command.make(
  'resume',
  {
    yes: Flag.boolean('yes').pipe(
      Flag.withAlias('y'),
      Flag.withDescription('Skip confirmation prompt (for CI)'),
      Flag.withDefault(false),
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
  ({ yes, tag, from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      if (Option.isSome(tag)) {
        yield* Console.error(
          'Resume uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
      const { plan, publishing } = yield* loadExecutableCommandPlan(from)

      const runtime = yield* Api.Explorer.explore()
      const runtimeConfig = Api.Explorer.toExecutorRuntimeConfig(runtime)
      if (!runtimeConfig.github) {
        yield* Console.error('GitHub release target and token are required for release resume.')
        yield* Console.error('Set GITHUB_TOKEN and ensure origin points to GitHub, then retry.')
        return env.exit(1)
      }

      const resumeAttempt = yield* Api.Executor.resumeObservable(plan, {
        dryRun: false,
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
        github: runtimeConfig.github,
      }).pipe(Effect.provide(Api.Executor.makeWorkflowRuntime()), Effect.result)

      if (resumeAttempt._tag === 'Failure') {
        if (resumeAttempt.failure._tag === 'ExecutorResumeError') {
          yield* Console.error(resumeAttempt.failure.message)
          return env.exit(1)
        }

        return yield* Effect.fail(resumeAttempt.failure)
      }

      const { events, execute, status: workflowStatus } = resumeAttempt.success

      yield* Console.log(
        Api.Executor.formatExecutionStatus(workflowStatus, {
          env: env.vars,
          resumeCommand: formatPlanCommand('release resume', from),
        }),
      )

      if (!yes) {
        const approved = yield* confirm('Resume interrupted release? [y/N] ')
        if (!approved) {
          yield* Console.log('Release resume canceled.')
          return env.exit(1)
        }
      }

      const eventFiber = yield* events.pipe(
        Stream.tap((event) => {
          const line = Api.Executor.formatLifecycleEvent(event, { env: env.vars })
          if (!line) return Effect.void
          return line.level === 'error' ? Console.error(line.message) : Console.log(line.message)
        }),
        Stream.runDrain,
        Effect.forkChild,
      )

      const result = yield* execute

      yield* Fiber.join(eventFiber)

      yield* Console.log(
        Api.Renderer.renderApplyDone(result.releasedPackages.length, { env: env.vars }),
      )

      yield* Api.Planner.Store.deleteActive
    }),
).pipe(
  Command.withDescription('Resume an interrupted release workflow'),
  Command.provide(
    Layer.mergeAll(Env.Live, FileSystemLayer, TerminalLayer, Git.GitLive, commandLayer, npmLayer),
  ),
)
