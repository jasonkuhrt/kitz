import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Str } from '@kitz/core'
import { Console, Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import * as Clock from '../../api/clock.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Proof from '../../api/proof.js'
import { ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer, fromFlag } from './_shared.js'
import { loadExecutableCommandPlan } from './plan-file.js'

export const prove = Command.make(
  'prove',
  {
    from: fromFlag,
  },
  ({ from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const { plan } = yield* loadExecutableCommandPlan(from)

      const localObservations = yield* Proof.collectLocalObservations(plan)
      const githubObservations = yield* Explorer.resolveGitHubContext().pipe(
        Effect.flatMap((context) =>
          Proof.collectGithubObservations(plan).pipe(
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
      const proof = yield* Proof.prove(plan, {
        ...localObservations,
        ...githubObservations,
      })
      const proofPath = Proof.proofPathFor(env.cwd, plan)
      const b = Str.Builder()
      b`Proof written to ${Fs.Path.toString(proofPath)}`
      for (const record of proof.records) {
        b`${record.status.padEnd(14)} ${record.id}`
      }
      yield* Console.log(b.render())
      if (Proof.hasBlockingProof(proof, yield* Clock.now)) return env.exit(1)
    }),
).pipe(
  Command.withDescription('Write plan-bound publishing proof'),
  Command.provide(
    Layer.mergeAll(CommandBaseLayer, ChildProcessSpawnerLayer, NpmCliLayer, Git.GitLive),
  ),
)
