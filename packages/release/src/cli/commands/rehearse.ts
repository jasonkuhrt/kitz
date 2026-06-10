import { Env } from '@kitz/env'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Artifact from '../../api/artifact.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { loadExecutableCommandPlan } from './plan-file.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

export const rehearse = Command.make(
  'rehearse',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
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
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer)),
)
