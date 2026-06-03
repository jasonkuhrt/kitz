import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

export const rehearse = Command.make(
  'rehearse',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
  },
  ({ from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const planPath = Option.isSome(from) ? Fs.Path.fromString(from.value) : undefined
      const planState = yield* loadPlan({
        ...(planPath !== undefined ? { path: planPath } : {}),
        source: planPath === undefined ? 'active' : 'custom',
      })

      if (planState._tag === 'PlanMissing') {
        for (const line of formatMissingPlanMessage(planState)) yield* Console.error(line)
        return env.exit(1)
      }

      if (planState._tag === 'PlanInvalid') {
        for (const line of formatInvalidPlanMessage(planState)) yield* Console.error(line)
        return env.exit(1)
      }

      const manifests = yield* Api.Artifact.rehearse(planState.plan)
      yield* Console.log(`Artifact manifest written for ${manifests.length} package(s).`)
    }),
).pipe(
  Command.withDescription('Build the plan-bound artifact manifest'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer)),
)
