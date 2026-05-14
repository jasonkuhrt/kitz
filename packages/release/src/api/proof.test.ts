import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Option } from 'effect'
import { Env } from '@kitz/env'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { OfficialFirst } from './version/models/official-first.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'
import {
  collectLocalObservations,
  collectGithubObservations,
  makeProofArtifact,
  prove,
  readForPlan,
  validateProof,
} from './proof.js'
import { sha256Text } from './digest.js'
import {
  PlanDigest,
  PlanSourceSnapshot,
  PublishIntent,
  PublishProfile,
  publishIntentFromSemantics,
} from './release-contract.js'

const plan = Plan.make({
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
})

const publishIntent = publishIntentFromSemantics({
  semantics: {
    lifecycle: 'official',
    channel: { mode: 'manual' },
    distTag: 'latest',
    prerelease: false,
    forcePushTag: false,
    githubReleaseStyle: 'versioned',
  },
  trunk: 'main',
})

const contractedDigest = PlanDigest.make(sha256Text('contracted'))

const contractedPlan = Plan.make({
  lifecycle: plan.lifecycle,
  timestamp: plan.timestamp,
  releases: plan.releases,
  cascades: plan.cascades,
  planDigest: contractedDigest,
  publishIntent,
})

const multiContractedPlan = Plan.make({
  lifecycle: plan.lifecycle,
  timestamp: plan.timestamp,
  releases: [
    ...plan.releases,
    Official.make({
      package: {
        name: Pkg.Moniker.parse('@kitz/cli'),
        scope: 'cli',
        path: Fs.Path.AbsDir.fromString('/repo/packages/cli/'),
      },
      version: OfficialFirst.make({
        version: Semver.fromString('1.0.0'),
        bump: 'minor',
      }),
      commits: [makeCascadeCommit('cli', 'feature')],
    }),
  ],
  cascades: [],
  planDigest: contractedDigest,
  publishIntent,
})

const npmCliError = (operation: NpmRegistry.Cli.NpmCliOperation, detail: string) =>
  new NpmRegistry.NpmCliError({
    context: { operation, detail },
    cause: new Error(detail),
  })

const gitError = (operation: Git.GitOperation, detail: string) =>
  new Git.GitError({
    context: { operation, detail },
    cause: new Error(detail),
  })

const unused = <A>() => Effect.die('unused test service operation') as Effect.Effect<A, never>

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
    ...overrides,
  })

describe('proof artifact', () => {
  test('uncontracted plans produce blocking proof records', () => {
    const proof = makeProofArtifact(plan)

    expect(proof.records.map((record) => record.status)).toContain('unprovable')
    expect(proof.records.some((record) => record.dependsOn.includes('plan.digest'))).toBe(true)
  })

  test('writes and reads plan-bound proof files', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const written = yield* prove(plan)
        const read = yield* readForPlan(plan)
        return { written, read }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result.read)).toBe(true)
    expect(result.written.planDigest.value).toBe(
      Option.isSome(result.read) ? result.read.value.planDigest.value : '',
    )
  })

  test('records selected provider capability proofs from the frozen publish intent', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })
    const ids = proof.records.map((record) => record.id)

    expect(ids).toContain('capability.pack.tarball')
    expect(ids).toContain('capability.publish.tarball')
    expect(ids).toContain('capability.publish.ignore-scripts')
    expect(proof.records.find((record) => record.id === 'capability.publish.tarball')?.status).toBe(
      'proven',
    )
    expect(
      proof.records.find((record) => record.id === 'env.publish.package-access.@kitz/core')?.status,
    ).toBe('proven')
    expect(
      proof.records.find((record) => record.id === 'env.publish.access-level.@kitz/core')?.status,
    ).toBe('proven')
  })

  test('credential, git, and GitHub proof records distinguish Feature 5 success and failure states', () => {
    const proven = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: {
        '@kitz/core@1.0.0': { ok: true, detail: 'dry-run accepted' },
      },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })
    const failed = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identityError: 'npm whoami failed',
      packageAccessErrors: { '@kitz/core': 'forbidden' },
      gitPushDryRun: {
        '@kitz/core@1.0.0': { ok: false, detail: 'remote rejected tag' },
      },
      githubReleasePermission: false,
      githubReleasePermissionError: 'contents write missing',
    })

    expect(proven.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'proven',
    )
    expect(
      proven.records.find((record) => record.id === 'env.git.push-dry-run.@kitz/core@1.0.0')
        ?.status,
    ).toBe('proven')
    expect(
      proven.records.find((record) => record.id === 'env.github.release-permission')?.status,
    ).toBe('proven')
    expect(
      proven.records.find((record) => record.id === 'env.github.release-by-tag.@kitz/core@1.0.0')
        ?.evidence,
    ).toMatchObject({ exists: false })

    expect(failed.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'failed',
    )
    expect(
      failed.records.find((record) => record.id === 'env.publish.package-access.@kitz/core')
        ?.status,
    ).toBe('failed')
    expect(
      failed.records.find((record) => record.id === 'env.git.push-dry-run.@kitz/core@1.0.0')
        ?.status,
    ).toBe('failed')
    expect(
      failed.records.find((record) => record.id === 'env.github.release-permission')?.status,
    ).toBe('failed')
  })

  test('atomic tag dry-run proof is recorded for multi-package plans', () => {
    const proof = makeProofArtifact(multiContractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public', '@kitz/cli': 'public' },
      gitPushDryRun: {
        '@kitz/core@1.0.0': { ok: true, detail: 'core accepted' },
        '@kitz/cli@1.0.0': { ok: true, detail: 'cli accepted' },
      },
      atomicGitPushDryRun: { ok: true, detail: 'atomic accepted' },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false, '@kitz/cli@1.0.0': false },
    })
    const atomic = proof.records.find((record) => record.id === 'env.git.push-dry-run.atomic')

    expect(atomic?.status).toBe('proven')
    expect(atomic?.dependsOn).toEqual([
      'env.git.push-dry-run.@kitz/core@1.0.0',
      'env.git.push-dry-run.@kitz/cli@1.0.0',
    ])
    expect(atomic?.evidence).toMatchObject({
      tags: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
      detail: 'atomic accepted',
    })
  })

  test('local proof observation reads npm identity/access and git dry-run push surfaces', async () => {
    const observations = await Effect.runPromise(
      collectLocalObservations(contractedPlan).pipe(
        Effect.provide(Layer.mergeAll(NpmRegistry.NpmCliDryRun, Git.Memory.make({}))),
      ),
    )
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', observations)

    expect(observations.identity).toBe('dry-run-user')
    expect(observations.packageAccess).toEqual({ '@kitz/core': 'public' })
    expect(observations.gitPushDryRun?.['@kitz/core@1.0.0']).toMatchObject({ ok: true })
    expect(proof.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'proven',
    )
  })

  test('GitHub proof observation reads existing release-by-tag state', async () => {
    const observations = await Effect.runPromise(
      Effect.gen(function* () {
        const gh = yield* Github.Github
        yield* gh.createRelease({
          tag: '@kitz/core@1.0.0',
          title: '@kitz/core 1.0.0',
          body: 'existing release',
        })
        return yield* collectGithubObservations(contractedPlan)
      }).pipe(Effect.provide(Github.Memory.make({}))),
    )
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      githubReleasePermission: true,
      ...observations,
    })

    expect(observations.githubReleaseExists).toEqual({ '@kitz/core@1.0.0': true })
    expect(
      proof.records.find((record) => record.id === 'env.github.release-by-tag.@kitz/core@1.0.0')
        ?.status,
    ).toBe('proven')
  })

  test('local proof observation records identity, access, git, and atomic dry-run failures', async () => {
    const observations = await Effect.runPromise(
      collectLocalObservations(multiContractedPlan).pipe(
        Effect.provide(
          Layer.mergeAll(
            npmCliLayer({
              whoami: () => Effect.fail(npmCliError('whoami', 'identity denied')),
              getAccessStatus: (packageName) =>
                packageName === '@kitz/core'
                  ? Effect.succeed('unknown')
                  : Effect.fail(npmCliError('access', 'access denied')),
            }),
            gitLayer({
              pushTagDryRun: (tag) =>
                tag === '@kitz/core@1.0.0'
                  ? Effect.fail(gitError('pushTagDryRun', 'tag rejected'))
                  : Effect.succeed({ stdout: 'cli accepted' }),
              pushTagsAtomicDryRun: () =>
                Effect.fail(gitError('pushTagsAtomicDryRun', 'atomic rejected')),
            }),
          ),
        ),
      ),
    )

    expect(observations.identityError).toContain('identity denied')
    expect(observations.packageAccessErrors?.['@kitz/core']).toContain('not public or restricted')
    expect(observations.packageAccessErrors?.['@kitz/cli']).toContain('access denied')
    expect(observations.gitPushDryRun?.['@kitz/core@1.0.0']).toMatchObject({
      ok: false,
      detail: 'Git pushTagDryRun failed: tag rejected',
    })
    expect(observations.gitPushDryRun?.['@kitz/cli@1.0.0']).toMatchObject({
      ok: true,
      detail: 'cli accepted',
    })
    expect(observations.atomicGitPushDryRun).toMatchObject({
      ok: false,
      detail: 'Git pushTagsAtomicDryRun failed: atomic rejected',
    })
  })

  test('does not require Bun publish ignore-scripts when publishing a prebuilt tarball', () => {
    const bunIntent = PublishIntent.make({
      ...publishIntent,
      profile: PublishProfile.make({
        ...publishIntent.profile,
        id: 'bun-tarball',
        packDriver: 'bun',
        publishInvoker: 'bun',
      }),
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: bunIntent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(proof.records.map((record) => record.id)).not.toContain(
      'capability.publish.ignore-scripts',
    )
    expect(proof.records.find((record) => record.id === 'capability.publish.tarball')?.status).toBe(
      'proven',
    )
  })

  test('provenance required mode blocks Bun and CircleCI required provenance', () => {
    const bunIntent = PublishIntent.make({
      ...publishIntent,
      profile: PublishProfile.make({
        ...publishIntent.profile,
        id: 'bun-tarball',
        publishInvoker: 'bun',
      }),
      provenance: {
        mode: 'trusted-publisher',
        required: true,
        provider: 'npm-github',
      },
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: bunIntent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(proof.records.find((record) => record.id === 'publish.provenance-policy')?.status).toBe(
      'blocked',
    )
  })

  test('trusted publisher provenance requires configured publisher and verified OIDC claims', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      provenance: {
        mode: 'trusted-publisher',
        required: true,
        provider: 'npm-github',
      },
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: intent,
      }),
      '2026-05-13T00:00:00.000Z',
      {
        trustedPublisherConfigured: true,
        oidcClaimsVerified: true,
      },
    )

    expect(proof.records.find((record) => record.id === 'publish.provenance-policy')?.status).toBe(
      'proven',
    )
  })

  test('attestation-file provenance records whether the bundle is present', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      provenance: {
        mode: 'attestation-file',
        required: true,
        file: Fs.Path.AbsFile.fromString('/repo/provenance.jsonl'),
      },
    })
    const basePlan = Plan.make({
      lifecycle: contractedPlan.lifecycle,
      timestamp: contractedPlan.timestamp,
      releases: contractedPlan.releases,
      cascades: contractedPlan.cascades,
      planDigest: contractedDigest,
      publishIntent: intent,
    })

    expect(
      makeProofArtifact(basePlan, '2026-05-13T00:00:00.000Z').records.find(
        (record) => record.id === 'publish.provenance-policy',
      )?.status,
    ).toBe('unprovable')
    expect(
      makeProofArtifact(basePlan, '2026-05-13T00:00:00.000Z', {
        provenanceBundleExists: true,
      }).records.find((record) => record.id === 'publish.provenance-policy')?.status,
    ).toBe('proven')
  })

  test('cli-flag provenance and source snapshots become explicit proof evidence', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      provenance: {
        mode: 'cli-flag',
        required: true,
      },
    })
    const source = PlanSourceSnapshot.make({
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
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        source,
        publishIntent: intent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(
      proof.records.find((record) => record.id === 'capability.publish.provenance-flag')?.status,
    ).toBe('proven')
    expect(proof.records.find((record) => record.id === 'publish.provenance-policy')?.status).toBe(
      'proven',
    )
    expect(proof.records.find((record) => record.id === 'plan.source')?.evidence).toMatchObject({
      headSha: 'abc1234',
    })
  })

  test('unattended runtime cannot rely on interactive otp', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      auth: {
        ...publishIntent.auth,
        runtimeHost: 'github-actions',
        otpPolicy: { mode: 'interactive' },
      },
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: intent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(proof.records.find((record) => record.id === 'env.publish.mfa-policy')?.status).toBe(
      'unprovable',
    )
  })

  test('GitHub Actions trusted publishing defers identity and release permission to the named host', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      auth: {
        ...publishIntent.auth,
        source: 'trusted-oidc',
        runtimeHost: 'github-actions',
        tokenEnv: undefined,
      },
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: intent,
      }),
      '2026-05-13T00:00:00.000Z',
      {
        packageAccess: { '@kitz/core': 'public' },
        gitPushDryRun: { '@kitz/core@1.0.0': true },
      },
    )

    expect(proof.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'deferredToHost',
    )
    expect(
      proof.records.find((record) => record.id === 'env.github.release-permission')?.status,
    ).toBe('deferredToHost')
  })

  test('unobserved Feature 5 proof surfaces are unprovable instead of assumed successful', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z')

    expect(proof.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'unprovable',
    )
    expect(
      proof.records.find((record) => record.id === 'env.publish.package-access.@kitz/core')?.status,
    ).toBe('unprovable')
    expect(
      proof.records.find((record) => record.id === 'env.git.push-dry-run.@kitz/core@1.0.0')?.status,
    ).toBe('unprovable')
    expect(
      proof.records.find((record) => record.id === 'env.github.release-permission')?.status,
    ).toBe('unprovable')
  })

  test('unattended runtime accepts otp from env without an interactive prompt', () => {
    const intent = PublishIntent.make({
      ...publishIntent,
      auth: {
        ...publishIntent.auth,
        runtimeHost: 'local-unattended',
        otpPolicy: { mode: 'env', env: 'NPM_CONFIG_OTP' },
      },
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: intent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(proof.records.find((record) => record.id === 'env.publish.mfa-policy')?.status).toBe(
      'proven',
    )
  })

  test('proof validation flags blocking, missing dependency, and expiry', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })
    const altered = {
      ...proof,
      records: [
        {
          ...proof.records[0]!,
          expiresAt: '2026-05-13T00:00:00.000Z',
        },
        {
          ...proof.records[1]!,
          dependsOn: ['missing-proof'],
        },
      ],
    }

    expect(validateProof(altered, '2026-05-13T00:00:01.000Z').map((issue) => issue.code)).toEqual([
      'release.proof.missing-dependency',
      'release.proof.expired',
    ])
  })
})
