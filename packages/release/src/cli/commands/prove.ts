import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { loadExecutableCommandPlan } from './plan-file.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

export const prove = Command.make(
  'prove',
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
      const { plan } = yield* loadExecutableCommandPlan(from)

      const localObservations = yield* Api.Proof.collectLocalObservations(plan)
      const githubObservations = yield* Api.Explorer.resolveGitHubContext().pipe(
        Effect.flatMap((context) =>
          Api.Proof.collectGithubObservations(plan).pipe(
            Effect.provide(
              Github.LiveFetch({
                owner: context.target.owner,
                repo: context.target.repo,
                ...(context.token !== null ? { token: context.token } : {}),
              }),
            ),
          ),
        ),
        Effect.catch(() => Effect.succeed({})),
      )
      const proof = yield* Api.Proof.prove(plan, {
        ...localObservations,
        ...githubObservations,
      })
      const proofPath = Api.Proof.proofPathFor(env.cwd, plan)
      yield* Console.log(`Proof written to ${Fs.Path.toString(proofPath)}`)
      for (const record of proof.records) {
        yield* Console.log(`${record.status.padEnd(14)} ${record.id}`)
      }
      if (Api.Proof.hasBlockingProof(proof, yield* Api.Clock.nowIso)) return env.exit(1)
    }),
).pipe(
  Command.withDescription('Write plan-bound publishing proof'),
  Command.provide(
    Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer, Git.GitLive),
  ),
)
