import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, FileSystem, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

const flagValue = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const argv = yield* Cli.parseArgv(env.argv)
    const args = argv.args.slice(1)
    const action = args[0] ?? 'export'
    if (action !== 'export') {
      yield* Console.error('Usage: release archive export --from <plan>')
      return env.exit(1)
    }

    const from = flagValue(args, '--from') ?? flagValue(args, '-f')
    const planPath = from !== undefined ? Fs.Path.fromString(from) : undefined
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
    const digest = Api.Proof.digestForPlan(planState.plan)
    const archivePath = Fs.Path.join(
      env.cwd,
      Fs.Path.RelFile.fromString(`./.release/archive/${digest.value}.json`),
    )
    const body = {
      schemaVersion: 1,
      planDigest: Schema.encodeSync(Api.ReleaseContract.PlanDigest)(digest),
      plan: Schema.encodeSync(Api.Planner.Plan)(planState.plan),
      proof: Option.isSome(proof)
        ? Schema.encodeSync(Api.ReleaseContract.ProofArtifact)(proof.value)
        : null,
      artifacts: Option.isSome(artifacts)
        ? Schema.encodeSync(Schema.Array(Api.ReleaseContract.ArtifactManifest))([
            ...artifacts.value,
          ])
        : [],
    }

    yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(archivePath)), { recursive: true })
    yield* fs.writeFileString(Fs.Path.toString(archivePath), `${JSON.stringify(body, null, 2)}\n`)
    yield* Console.log(`Audit archive written to ${Fs.Path.toString(archivePath)}`)
  }),
)
