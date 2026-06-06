/**
 * @module cli/commands/resume
 *
 * Resume an interrupted durable release workflow for the active release plan.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Fiber, Layer, Option, Schema, Stream, Terminal } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer, TerminalLayer } from '../../platform.js'
import {
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  formatUnsupportedExecutionPlanMessage,
  hasExecutablePlanContract,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'
import { makeProofRecheckHook } from './proof-recheck-hook.js'

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
          'Resume uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
      if (!hasExecutablePlanContract(plan)) {
        for (const line of formatUnsupportedExecutionPlanMessage(plan)) yield* Console.error(line)
        return env.exit(1)
      }
      const publishing = Api.Publishing.publishingFromIntent(plan.publishIntent)

      // The plan-bound proof that `release apply` wrote is the basis for the
      // pre-each-mutation recheck the executor runs before the single
      // not-yet-completed mutation this resume is driving into. Resume is the
      // exact window where a credential can expire (an operator suspends, fixes
      // an unrelated issue, and resumes later), so the gate must fire here too —
      // not just on the original fresh apply. Without a proof on disk there is
      // nothing to recheck against; refuse rather than resume un-gated.
      const proofResult = yield* Effect.result(Api.Proof.readForPlan(plan))
      if (proofResult._tag === 'Failure') {
        if (Schema.isSchemaError(proofResult.failure)) {
          yield* Console.error('Plan-bound proof is unreadable (stale or invalid proof schema).')
          yield* Console.error('Run `release prove` to refresh it before resuming.')
          return env.exit(1)
        }
        return yield* Effect.fail(proofResult.failure)
      }
      const proof = proofResult.success
      if (Option.isNone(proof)) {
        yield* Console.error('Plan-bound proof is missing; cannot recheck credentials on resume.')
        yield* Console.error('Run `release prove` before resuming.')
        return env.exit(1)
      }
      if (Api.Proof.hasBlockingProof(proof.value, plan.proofPolicy)) {
        yield* Console.error('Plan-bound proof contains blocking records.')
        yield* Console.error('Run `release prove` and resolve every failed or unprovable proof.')
        return env.exit(1)
      }

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
        beforeMutation: makeProofRecheckHook({ plan, prior: proof.value }),
      }).pipe(Effect.provide(Api.Executor.makeWorkflowRuntime()), Effect.result)

      if (resumeAttempt._tag === 'Failure') {
        if (resumeAttempt.failure._tag === 'ExecutorResumeError') {
          yield* Console.error(resumeAttempt.failure.message)
          return env.exit(1)
        }

        return yield* Effect.fail(resumeAttempt.failure)
      }

      const { events, execute, status: workflowStatus } = resumeAttempt.success

      yield* Console.log(Api.Executor.formatExecutionStatus(workflowStatus, { env: env.vars }))

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
