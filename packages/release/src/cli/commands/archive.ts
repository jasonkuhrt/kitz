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
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

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

      const proof = yield* Api.Proof.readForPlan(planState.plan)
      const artifacts = yield* Api.Artifact.readManifest(planState.plan)
      const digest = Api.ReleaseContract.digestForPlan(planState.plan)
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
            content: `${JSON.stringify(Schema.encodeSync(Api.Planner.Plan)(planState.plan), null, 2)}\n`,
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
