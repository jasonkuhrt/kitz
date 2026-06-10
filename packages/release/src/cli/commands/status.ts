/**
 * @module cli/commands/status
 *
 * Show durable workflow state for the active release plan.
 *
 * Reads `.release/plan.json`, derives the same workflow identity used by
 * `release apply`, and polls the durable workflow runtime for its current state.
 */
import { Env } from '@kitz/env'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { formatPlanCommand, loadExecutableCommandPlan } from './plan-file.js'

export const status = Command.make(
  'status',
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
          'Status uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
      const { plan, publishing } = yield* loadExecutableCommandPlan(from)

      const workflowStatus = yield* Api.Executor.status(plan, {
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
      }).pipe(Effect.provide(Api.Executor.makeWorkflowRuntime()))
      yield* Console.log(
        format === 'json'
          ? JSON.stringify(workflowStatus, null, 2)
          : Api.Executor.formatExecutionStatus(workflowStatus, {
              env: env.vars,
              nextApplyCommand: formatPlanCommand('release apply', from),
              resumeCommand: formatPlanCommand('release resume', from),
            }),
      )
    }),
).pipe(
  Command.withDescription('Show durable workflow state for a saved release plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
