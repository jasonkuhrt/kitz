import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import { makeCascadeCommit } from '../../api/analyzer/models/commit.js'
import { makeProofArtifact } from '../../api/proof.js'
import { Official } from '../../api/planner/models/item-official.js'
import { Plan } from '../../api/planner/models/plan.js'
import {
  PlanDigest,
  PlanSourceSnapshot,
  publishIntentFromSemantics,
} from '../../api/release-contract.js'
import { sha256Text } from '../../api/digest.js'
import { OfficialFirst } from '../../api/version/models/official-first.js'
import { makeProofRecheckHook } from './apply.js'

// A Plan WITH publishIntent so the proof artifact carries the
// `pre-each-mutation` records the recheck hook re-derives (package access,
// access level, and git push dry-run for @kitz/core@1.0.0).
const contractedPlan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-01-01T00:00:00Z',
  releases: [
    Official.make({
      package: {
        name: Pkg.Moniker.parse('@kitz/core'),
        scope: 'core',
        path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
      },
      version: OfficialFirst.make({
        version: Semver.fromString('1.0.0'),
        bump: 'major',
      }),
      commits: [makeCascadeCommit('core', 'feature')],
    }),
  ],
  cascades: [],
  planDigest: PlanDigest.make(sha256Text('contracted')),
  // A frozen source snapshot so the out-of-phase `plan.source` proof record is
  // `proven` in the prior — otherwise it stays `unprovable` and blocks the
  // healthy case for a reason unrelated to the pre-each-mutation recheck.
  source: PlanSourceSnapshot.make({
    headSha: 'abc1234',
    trunk: 'main',
    releaseConfigDigest: sha256Text('config'),
    releaseConfigDigestSource: 'canonical-effective-config',
    lockfiles: [],
    packageManager: {
      name: 'npm',
      version: '11.14.1',
      binary: 'npm',
      subcommands: { pack: true, publish: true },
    },
    toolVersions: { npm: '11.14.1' },
  }),
  publishIntent: publishIntentFromSemantics({
    semantics: {
      lifecycle: 'official',
      channel: { mode: 'manual' },
      distTag: 'latest',
      prerelease: false,
      forcePushTag: false,
      githubReleaseStyle: 'versioned',
    },
    trunk: 'main',
  }),
})

const npmCliError = (operation: NpmRegistry.Cli.NpmCliOperation, detail: string) =>
  new NpmRegistry.NpmCliError({
    context: { operation, detail },
    cause: new Error(detail),
  })

const unused = () => Effect.die('unused test service operation')

const npmCliLayer = (
  overrides: Partial<NpmRegistry.NpmCliService>,
): Layer.Layer<NpmRegistry.NpmCli> =>
  Layer.succeed(NpmRegistry.NpmCli, {
    whoami: () => Effect.succeed('octocat'),
    pack: () => unused(),
    publish: () => unused(),
    hasVersion: () => unused(),
    observeVersion: () => unused(),
    listAccessPackages: () => unused(),
    listAccessCollaborators: () => unused(),
    getAccessStatus: () => Effect.succeed('public'),
    ...overrides,
  })

const gitLayer = (overrides: Partial<Git.GitService>): Layer.Layer<Git.Git> =>
  Layer.succeed(Git.Git, {
    getTags: () => unused(),
    getCurrentBranch: () => unused(),
    getCommitsSince: () => unused(),
    isClean: () => unused(),
    createTag: () => unused(),
    pushTags: () => unused(),
    pushTagsAtomic: () => unused(),
    pushTagDryRun: () => Effect.succeed({ stdout: 'dry-run accepted' }),
    pushTagsAtomicDryRun: () => Effect.succeed({ stdout: 'atomic dry-run accepted' }),
    getRoot: () => unused(),
    getHeadSha: () => unused(),
    getTagSha: () => unused(),
    isAncestor: () => unused(),
    createTagAt: () => unused(),
    deleteTag: () => unused(),
    commitExists: () => unused(),
    pushTag: () => unused(),
    deleteRemoteTag: () => unused(),
    getRemoteUrl: () => unused(),
    getHooksDir: () => unused(),
    ...overrides,
  })

// A healthy `prior` proof: every pre-each-mutation surface (identity, package
// access, git push dry-run) is proven before the run starts.
const healthyPrior = () =>
  makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
    identity: 'octocat',
    packageAccess: { '@kitz/core': 'public' },
    gitPushDryRun: { '@kitz/core@1.0.0': true },
    githubReleasePermission: true,
    githubReleaseExists: { '@kitz/core@1.0.0': false },
  })

const mutationContext = {
  kind: 'registry-publish',
  subject: '@kitz/core@1.0.0',
  planned: {},
} as const

describe('makeProofRecheckHook', () => {
  test('blocks the next mutation when a credential expired mid-run', async () => {
    const hook = makeProofRecheckHook({ plan: contractedPlan, prior: healthyPrior() })
    // Effect.flip surfaces the gate's tagged error as the success value; a no-op
    // hook (or one that succeeded) would have no error to flip and would die.
    const error = await Effect.runPromise(
      hook(mutationContext).pipe(
        Effect.flip,
        Effect.provide(
          Layer.mergeAll(
            npmCliLayer({
              whoami: () => Effect.fail(npmCliError('whoami', 'token expired')),
            }),
            gitLayer({}),
          ),
        ),
      ),
    )

    // The hook re-observed local surfaces via collectLocalObservations (whoami
    // now fails), re-derived the pre-each-mutation records, found a blocking
    // record, and aborted the mutation with the executor's gate error.
    expect(error._tag).toBe('ExecutorBeforeMutationError')
  })

  test('allows the mutation when credentials are still healthy', async () => {
    const hook = makeProofRecheckHook({ plan: contractedPlan, prior: healthyPrior() })
    const exit = await Effect.runPromise(
      hook(mutationContext).pipe(
        Effect.exit,
        Effect.provide(Layer.mergeAll(npmCliLayer({}), gitLayer({}))),
      ),
    )

    // whoami succeeds, getAccessStatus is 'public', and the git push dry-run is
    // accepted — the re-derived pre-each-mutation records stay proven, so the
    // gate lets the mutation proceed.
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
