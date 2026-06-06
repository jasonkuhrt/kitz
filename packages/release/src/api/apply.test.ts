import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { make as makeGitTest } from '@kitz/git/test'
import { NpmRegistry } from '@kitz/npm-registry'
import { make as makeNpmCliTest } from '@kitz/npm-registry/test'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { apply } from './apply.js'
import { sha256Text } from './digest.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'
import { makeProofArtifact, proofPathFor, write as writeProof } from './proof.js'
import { PlanDigest, PlanSourceSnapshot, publishIntentFromSemantics } from './release-contract.js'
import { OfficialFirst } from './version/models/official-first.js'

// A contracted plan WITH publishIntent and a frozen source snapshot so the
// static `plan.source` proof record is proven in a healthy prior (otherwise it
// stays unprovable and blocks the disk-proof gate for an unrelated reason).
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
      version: OfficialFirst.make({ version: Semver.fromString('1.0.0'), bump: 'major' }),
      commits: [makeCascadeCommit('core', 'feature')],
    }),
  ],
  cascades: [],
  planDigest: PlanDigest.make(sha256Text('apply-op')),
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

const cwd = Fs.Path.AbsDir.fromString('/repo/')

// A non-GitHub origin so the gauntlet's GitHub-context resolution fails and the
// recheck re-observes local surfaces only — no network call.
const baseLayer = (npm: ReturnType<typeof makeNpmCliTest>) =>
  Layer.mergeAll(
    Env.Test({ cwd }),
    Fs.Memory.layer({}),
    npm.$test.layer(),
    makeGitTest({ remoteUrl: 'git@gitlab.com:example/repo.git' }).$test.layer(),
  )

const healthyObservations = {
  identity: 'octocat',
  packageAccess: { '@kitz/core': 'public' as const },
  gitPushDryRun: { '@kitz/core@1.0.0': true },
  githubReleasePermission: true,
  githubReleaseExists: { '@kitz/core@1.0.0': false },
}

describe('apply gauntlet', () => {
  test('returns ProofMissing when no plan-bound proof exists on disk', async () => {
    const result = await Effect.runPromise(
      apply(contractedPlan, { prove: false, rehearse: false }).pipe(
        Effect.provide(baseLayer(makeNpmCliTest({ whoamiUser: 'octocat' }))),
      ),
    )
    expect(result._tag).toBe('ProofMissing')
  })

  test('blocks at the disk-proof gate (before the recheck overwrites it) for a blocking prior', async () => {
    // A proof with no observations leaves its records unprovable → blocking.
    const blockingProof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {})
    const path = proofPathFor(cwd, contractedPlan)
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* writeProof(blockingProof, path)
        return yield* apply(contractedPlan, { prove: false, rehearse: false })
      }).pipe(Effect.provide(baseLayer(makeNpmCliTest({ whoamiUser: 'octocat' })))),
    )
    expect(result._tag).toBe('Blocked')
    if (result._tag === 'Blocked') expect(result.stage).toBe('disk-proof')
  })

  test('blocks at the recheck gate when a re-observed credential fails on a healthy prior', async () => {
    // Healthy prior passes the disk-proof gate; whoami now fails, so the
    // pre-mutation recheck rebuilds a blocking identity record before execute.
    const healthy = makeProofArtifact(
      contractedPlan,
      '2026-05-13T00:00:00.000Z',
      healthyObservations,
    )
    const npm = makeNpmCliTest({ whoamiUser: 'octocat' })
    npm.whoami.everyFail(
      new NpmRegistry.NpmCliError({
        context: { operation: 'whoami', detail: 'token expired' },
        cause: new Error('token expired'),
      }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* writeProof(healthy, proofPathFor(cwd, contractedPlan))
        return yield* apply(contractedPlan, { prove: false, rehearse: false })
      }).pipe(Effect.provide(baseLayer(npm))),
    )
    expect(result._tag).toBe('Blocked')
    if (result._tag === 'Blocked') expect(result.stage).toBe('recheck')
  })
})
