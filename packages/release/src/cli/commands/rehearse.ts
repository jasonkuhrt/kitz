import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Artifact from '../../api/artifact.js'
import { ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer, fromFlag } from './_shared.js'
import { loadExecutableCommandPlan } from './plan-file.js'

export const rehearse = Command.make(
  'rehearse',
  {
    from: fromFlag,
    publishDryRun: Flag.boolean('publish-dry-run').pipe(
      Flag.withDescription('Also run package-manager publish --dry-run for each artifact'),
      Flag.withDefault(false),
    ),
  },
  ({ from, publishDryRun }) =>
    Effect.gen(function* () {
      const { plan } = yield* loadExecutableCommandPlan(from)

      const manifests = yield* Artifact.rehearse(plan, { publishDryRun })
      yield* Console.log(`Artifact manifest written for ${manifests.length} package(s).`)
    }),
).pipe(
  Command.withDescription('Build the plan-bound artifact manifest'),
  Command.provide(Layer.mergeAll(CommandBaseLayer, ChildProcessSpawnerLayer, NpmCliLayer)),
)
