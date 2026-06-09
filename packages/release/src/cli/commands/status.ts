/**
 * @module cli/commands/status
 *
 * Show durable workflow state for the active release plan.
 *
 * Reads `.release/plan.json`, derives the same workflow identity used by
 * `release apply`, and polls the durable workflow runtime for its current state.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  formatUnsupportedExecutionPlanMessage,
  hasExecutablePlanContract,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'

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
          'Status uses the frozen plan dist-tag; --tag cannot alter workflow identity.',
        )
        return env.exit(1)
      }
      if (!hasExecutablePlanContract(plan)) {
        for (const line of formatUnsupportedExecutionPlanMessage(plan)) yield* Console.error(line)
        return env.exit(1)
      }
      const publishing = Api.Publishing.publishingFromIntent(plan.publishIntent)

      const workflowStatus = yield* Api.Executor.status(plan, {
        tag: plan.publishIntent.distTag,
        publishing,
        trunk: plan.publishIntent.git.trunk,
      }).pipe(Effect.provide(Api.Executor.makeWorkflowRuntime()))

      yield* Console.log(
        format === 'json'
          ? JSON.stringify(workflowStatus, null, 2)
          : Api.Executor.formatExecutionStatus(workflowStatus, { env: env.vars }),
      )
    }),
).pipe(
  Command.withDescription('Show durable workflow state for a saved release plan'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
