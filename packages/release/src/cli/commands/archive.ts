/**
 * @module cli/commands/archive
 *
 * Export a release audit archive (`release archive export`) bundling the plan,
 * proof, journal, and artifact manifest for a given release plan.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, FileSystem, Layer, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { loadExecutableCommandPlan } from './plan-file.js'

const archiveExport = Command.make(
  'export',
  {
    from: Flag.string('from').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Plan file to archive (default: the active plan)'),
      Flag.optional,
    ),
  },
  ({ from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const fs = yield* FileSystem.FileSystem
      const { plan, planDigest: digest } = yield* loadExecutableCommandPlan(from)
      const proof = yield* Api.Proof.readForPlan(plan)
      const artifacts = yield* Api.Artifact.readManifest(plan)
      const journalEntries = yield* Api.Journal.readEntries(
        Api.Journal.journalPathFor(env.cwd, digest),
      )
      const archivePath = Fs.Path.join(
        env.cwd,
        Fs.Path.RelFile.fromString(`./.release/archive/${digest.value}.kitz-release-audit.tgz`),
      )
      const bundle = Api.AuditArchive.makeAuditArchive({
        planDigest: digest,
        createdAt: new Date().toISOString(),
        payloads: [
          {
            path: Fs.Path.RelFile.fromString('./plan.json'),
            content: `${JSON.stringify(Schema.encodeSync(Api.Planner.Plan)(plan), null, 2)}\n`,
          },
          {
            path: Fs.Path.RelFile.fromString('./proof.json'),
            content: `${JSON.stringify(
              Option.isSome(proof)
                ? Schema.encodeSync(Api.ReleaseContract.ProofArtifact)(proof.value)
                : null,
              null,
              2,
            )}\n`,
          },
          {
            path: Fs.Path.RelFile.fromString('./journal.jsonl'),
            content:
              journalEntries
                .map((entry) =>
                  JSON.stringify(Schema.encodeSync(Api.ReleaseContract.SideEffectEntry)(entry)),
                )
                .join('\n') + '\n',
          },
          {
            path: Fs.Path.RelFile.fromString('./artifact-manifest.json'),
            content: `${JSON.stringify(
              Option.isSome(artifacts)
                ? Schema.encodeSync(Schema.Array(Api.ReleaseContract.ArtifactManifest))([
                    ...artifacts.value,
                  ])
                : [],
              null,
              2,
            )}\n`,
          },
          {
            path: Fs.Path.RelFile.fromString('./registry-observations.json'),
            content: '[]\n',
          },
        ],
      })

      yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(archivePath)), { recursive: true })
      yield* fs.writeFile(Fs.Path.toString(archivePath), bundle.bytes)
      yield* Console.log(`Audit archive written to ${Fs.Path.toString(archivePath)}`)
    }),
).pipe(Command.withDescription('Export a release audit archive'))

export const archive = Command.make('archive').pipe(
  Command.withDescription('Export a release audit archive'),
  Command.withSubcommands([archiveExport]),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
