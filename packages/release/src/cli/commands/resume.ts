/**
 * @module cli/commands/resume
 *
 * Resume an interrupted durable release workflow for the active release plan.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Executor from '../../api/executor/__.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Planner from '../../api/planner/__.js'
import * as Renderer from '../../api/renderer/__.js'
import { ChildProcessSpawnerLayer, TerminalLayer } from '../../platform.js'
import {
  CommandBaseLayer,
  NpmCliLayer,
  failWith,
  fromFlagNoAlias,
  rejectFrozenTag,
} from './_shared.js'
import { confirm, runObservableCommand } from './execution.js'
import { formatPlanCommand, loadExecutableCommandPlan } from './plan-file.js'

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
    from: fromFlagNoAlias,
  },
  ({ yes, tag, from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      yield* rejectFrozenTag(tag)
      const { plan, publishing } = yield* loadExecutableCommandPlan(from)

      const runtime = yield* Explorer.explore()
      const runtimeConfig = Explorer.toExecutorRuntimeConfig(runtime)
      if (!runtimeConfig.github) {
        yield* failWith(
          'GitHub release target and token are required for release resume.',
          'Set GITHUB_TOKEN and ensure origin points to GitHub, then retry.',
        )
        return
      }

      const resumeAttempt = yield* Executor.resumeObservable(plan, {
        dryRun: false,
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
        github: runtimeConfig.github,
      }).pipe(Effect.provide(Executor.makeWorkflowRuntime()), Effect.result)

      if (resumeAttempt._tag === 'Failure') {
        if (resumeAttempt.failure._tag === 'ExecutorResumeError') {
          yield* failWith(resumeAttempt.failure.message)
          return
        }

        yield* Effect.fail(resumeAttempt.failure)
        return
      }

      const { events, execute, status: workflowStatus } = resumeAttempt.success

      yield* Console.log(
        Renderer.formatExecutionStatus(workflowStatus, {
          env: env.vars,
          resumeCommand: formatPlanCommand('release resume', from),
        }),
      )

      if (!yes) {
        const approved = yield* confirm('Resume interrupted release? [y/N] ')
        if (!approved) {
          yield* Console.log('Release resume canceled.')
          env.exit(1)
          return
        }
      }

      yield* runObservableCommand({ events, execute })

      yield* Planner.Store.deleteActive
    }),
).pipe(
  Command.withDescription('Resume an interrupted release workflow'),
  Command.provide(
    Layer.mergeAll(
      CommandBaseLayer,
      TerminalLayer,
      Git.GitLive,
      ChildProcessSpawnerLayer,
      NpmCliLayer,
    ),
  ),
)
