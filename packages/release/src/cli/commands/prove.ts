import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { formatInvalidPlanMessage, formatMissingPlanMessage, loadPlan } from './plan-file.js'

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

      const localObservations = yield* Api.Proof.collectLocalObservations(planState.plan)
      const githubObservations = yield* Api.Explorer.resolveGitHubContext().pipe(
        Effect.flatMap((context) =>
          Api.Proof.collectGithubObservations(planState.plan).pipe(
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
      const proof = yield* Api.Proof.prove(planState.plan, {
        ...localObservations,
        ...githubObservations,
      })
      const proofPath = Api.Proof.proofPathFor(env.cwd, planState.plan)
      yield* Console.log(`Proof written to ${Fs.Path.toString(proofPath)}`)
      for (const record of proof.records) {
        yield* Console.log(`${record.status.padEnd(14)} ${record.id}`)
      }
      for (const issue of Api.Proof.validateProof(proof, undefined, planState.plan.proofPolicy)) {
        if (issue.severity === 'soft') {
          yield* Console.error(`warning: ${issue.code}: ${issue.detail}`)
        }
      }
      if (Api.Proof.hasBlockingProof(proof, planState.plan.proofPolicy)) return env.exit(1)
    }),
).pipe(
  Command.withDescription('Write plan-bound publishing proof'),
  Command.provide(
    Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer, Git.GitLive),
  ),
)
