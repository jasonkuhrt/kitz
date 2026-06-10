/**
 * @module cli/commands/prune
 *
 * Prune stale release artifact directories (`release prune`), retaining the
 * active plan's artifacts plus all plans, proofs, and journals.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Console, Effect, FileSystem, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Proof from '../../api/proof.js'
import { FileSystemLayer } from '../../platform.js'
import { loadPlan } from './plan-file.js'

export const prune = Command.make(
  'prune',
  {
    yes: Flag.boolean('yes').pipe(
      Flag.withAlias('y'),
      Flag.withDescription('Remove the stale artifact directories instead of listing them'),
      Flag.withDefault(false),
    ),
  },
  ({ yes }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const fs = yield* FileSystem.FileSystem
      const planState = yield* loadPlan({ source: 'active' }).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      const retainedDigest =
        planState?._tag === 'PlanLoaded' ? Proof.digestForPlan(planState.plan).value : undefined
      const artifactRoot = Fs.Path.join(env.cwd, Fs.Path.RelDir.fromString('./.release/artifacts/'))
      const dirs = yield* fs
        .readDirectory(Fs.Path.toString(artifactRoot))
        .pipe(Effect.orElseSucceed(() => [] as string[]))
      const prunable = dirs.filter((dir) => dir !== retainedDigest)

      if (prunable.length === 0) {
        yield* Console.log('No stale artifact directories to prune.')
        return
      }

      for (const dir of prunable) {
        const path = Fs.Path.join(artifactRoot, Fs.Path.RelDir.fromString(`./${dir}/`))
        if (yes) {
          yield* fs.remove(Fs.Path.toString(path), { recursive: true, force: true })
          yield* Console.log(`Pruned ${Fs.Path.toString(path)}`)
        } else {
          yield* Console.log(`Would prune ${Fs.Path.toString(path)}`)
        }
      }

      if (!yes) {
        yield* Console.log('Run `release prune --yes` to remove these artifact directories.')
      }
      yield* Console.log('Plans, proofs, and journals were retained.')
    }),
).pipe(
  Command.withDescription('Prune stale release artifact directories'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
