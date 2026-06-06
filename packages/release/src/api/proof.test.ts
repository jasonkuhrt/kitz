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
  deferredProofsForArtifact,
  hasBlockingProof,
  makeProofArtifact,
  mergeProofHistory,
  prove,
  readForPlan,
  recheckProof,
  validateProof,
} from './proof.js'
import { sha256Text } from './digest.js'
import {
  DeferredProof,
  PlanDigest,
  PlanSourceSnapshot,
  ProofArtifact,
  ProofRecord,
  CredentialIntent,
  defaultProofPolicy,
  ProofPolicy,
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
const updatePublishIntent = (intent: PublishIntent, overrides: Partial<PublishIntent>) =>
  PublishIntent.make(Object.assign({}, intent, overrides))

const updatePublishProfile = (profile: PublishProfile, overrides: Partial<PublishProfile>) =>
  PublishProfile.make(Object.assign({}, profile, overrides))

const updateCredentialIntent = (intent: CredentialIntent, overrides: Partial<CredentialIntent>) =>
  CredentialIntent.make(Object.assign({}, intent, overrides))

const updateProofArtifact = (artifact: ProofArtifact, overrides: Partial<ProofArtifact>) =>
  ProofArtifact.make(Object.assign({}, artifact, overrides))

const updateProofPolicy = (policy: ProofPolicy, overrides: Partial<ProofPolicy>) =>
  ProofPolicy.make(Object.assign({}, policy, overrides))

const updateProofRecord = (record: ProofRecord, overrides: Partial<ProofRecord>) =>
  ProofRecord.make(Object.assign({}, record, overrides))

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

  test('re-prove appends to proofHistory rather than overwriting it', async () => {
    const recordId = 'env.publish.package-access.@kitz/core'
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* prove(contractedPlan, {
          packageAccessErrors: { '@kitz/core': 'forbidden' },
        })
        const second = yield* prove(contractedPlan, {
          identity: 'octocat',
          packageAccess: { '@kitz/core': 'public' },
        })
        return { first, second }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    const firstRecord = result.first.records.find((record) => record.id === recordId)
    const secondRecord = result.second.records.find((record) => record.id === recordId)
    expect(firstRecord?.proofHistory).toHaveLength(1)
    expect(secondRecord?.proofHistory).toHaveLength(2)
    expect(secondRecord?.proofHistory[1]?.from).toBe(firstRecord?.status)
    expect(secondRecord?.proofHistory[1]?.to).toBe(secondRecord?.status)
    expect(secondRecord?.status).toBe('proven')
  })

  test('re-prove with an unchanged status appends no duplicate transition', async () => {
    const recordId = 'env.publish.package-access.@kitz/core'
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* prove(contractedPlan, {
          identity: 'octocat',
          packageAccess: { '@kitz/core': 'public' },
        })
        return yield* prove(contractedPlan, {
          identity: 'octocat',
          packageAccess: { '@kitz/core': 'public' },
        })
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(result.records.find((record) => record.id === recordId)?.proofHistory).toHaveLength(1)
  })

  test('mergeProofHistory carries prior history forward only for shared ids; new ids stay single', () => {
    const prior = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      packageAccessErrors: { '@kitz/core': 'forbidden' },
    })
    // Fresh proof shares the same id set but flips package-access to proven.
    const fresh = makeProofArtifact(contractedPlan, '2026-05-13T01:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
    })
    // Drop one id from the prior so it is "new" relative to prior.
    const priorMissingIdentity = updateProofArtifact(prior, {
      records: prior.records.filter((record) => record.id !== 'env.publish.identity'),
    })

    const merged = mergeProofHistory(priorMissingIdentity, fresh)
    // env.publish.identity was absent from prior -> single fresh element.
    expect(
      merged.records.find((record) => record.id === 'env.publish.identity')?.proofHistory,
    ).toHaveLength(1)
    // package-access existed in prior with a different status -> appended.
    const packageAccess = merged.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(packageAccess?.proofHistory).toHaveLength(2)
    expect(packageAccess?.proofHistory[1]?.from).toBe('failed')
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
    // package-access dependsOn the failed identity, so it cascades to blocked
    // (root-caused by identity) rather than reporting its own observed failure.
    const failedPackageAccess = failed.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(failedPackageAccess?.status).toBe('blocked')
    expect(failedPackageAccess?.blockedBy).toBe('env.publish.identity')
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
    const bunIntent = updatePublishIntent(publishIntent, {
      profile: updatePublishProfile(publishIntent.profile, {
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
    const bunIntent = updatePublishIntent(publishIntent, {
      profile: updatePublishProfile(publishIntent.profile, {
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
    const intent = updatePublishIntent(publishIntent, {
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
    const intent = updatePublishIntent(publishIntent, {
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
    const intent = updatePublishIntent(publishIntent, {
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
    const intent = updatePublishIntent(publishIntent, {
      auth: updateCredentialIntent(publishIntent.auth, {
        runtimeHost: 'github-actions',
        otpPolicy: { mode: 'interactive' },
      }),
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
    const intent = updatePublishIntent(publishIntent, {
      auth: updateCredentialIntent(publishIntent.auth, {
        source: 'trusted-oidc',
        runtimeHost: 'github-actions',
        tokenEnv: undefined,
      }),
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
    const intent = updatePublishIntent(publishIntent, {
      auth: updateCredentialIntent(publishIntent.auth, {
        runtimeHost: 'local-unattended',
        otpPolicy: { mode: 'env', env: 'NPM_CONFIG_OTP' },
      }),
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
    const altered = updateProofArtifact(proof, {
      records: [
        updateProofRecord(proof.records[0]!, {
          expiresAt: '2026-05-13T00:00:00.000Z',
        }),
        updateProofRecord(proof.records[1]!, {
          dependsOn: ['missing-proof'],
        }),
      ],
    })

    expect(validateProof(altered, '2026-05-13T00:00:01.000Z').map((issue) => issue.code)).toEqual([
      'release.proof.missing-dependency',
      'release.proof.expired',
    ])
  })
})

const oidcDeferredPlan = (() => {
  const intent = updatePublishIntent(publishIntent, {
    auth: updateCredentialIntent(publishIntent.auth, {
      source: 'trusted-oidc',
      runtimeHost: 'github-actions',
      tokenEnv: undefined,
    }),
  })
  return Plan.make({
    lifecycle: contractedPlan.lifecycle,
    timestamp: contractedPlan.timestamp,
    releases: contractedPlan.releases,
    cascades: contractedPlan.cascades,
    planDigest: contractedDigest,
    publishIntent: intent,
  })
})()

describe('DeferredProof projection', () => {
  test('DeferredProof is a distinct class, not the deferredToHost status', () => {
    const proof = makeProofArtifact(oidcDeferredPlan, '2026-05-13T00:00:00.000Z', {
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
    })

    // The status literal stays intact on the record.
    expect(proof.records.find((record) => record.id === 'env.publish.identity')?.status).toBe(
      'deferredToHost',
    )

    // The structured projection is its own DeferredProof record.
    const deferred = deferredProofsForArtifact(proof)
    const identity = deferred.find((entry) => entry.recordId === 'env.publish.identity')
    expect(DeferredProof.is(identity)).toBe(true)
    expect(identity?.deferredTo).toBe('github-actions')
    expect(deferred.map((entry) => entry.recordId)).toContain('env.github.release-permission')
  })

  test('DeferredProof round-trips through its own codec', () => {
    const deferred = DeferredProof.make({
      recordId: 'env.publish.identity',
      deferredTo: 'github-actions',
      reason: 'identity is deferred to trusted runtime host',
      observedAt: '2026-05-13T00:00:00.000Z',
    })

    const roundTrip = DeferredProof.decodeSync(DeferredProof.encodeSync(deferred))
    expect(roundTrip.recordId).toBe('env.publish.identity')
    expect(roundTrip.deferredTo).toBe('github-actions')
  })

  test('a plan with no host-deferred records projects no DeferredProofs', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

    expect(deferredProofsForArtifact(proof)).toEqual([])
  })
})

describe('dependsOn blocked cascade', () => {
  test('a failed dependency cascades its dependents to blocked with the root cause', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccessErrors: { '@kitz/core': 'forbidden' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

    // The root cause record is the failed package-access observation.
    const root = proof.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(root?.status).toBe('failed')
    expect(root?.blockedBy).toBeUndefined()

    // Its dependent (access-level) cascades to blocked carrying the root cause.
    const dependent = proof.records.find(
      (record) => record.id === 'env.publish.access-level.@kitz/core',
    )
    expect(dependent?.status).toBe('blocked')
    expect(dependent?.blockedBy).toBe('env.publish.package-access.@kitz/core')
  })

  test('cascade appends a transition with from + cause to the dependent history', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccessErrors: { '@kitz/core': 'forbidden' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

    const dependent = proof.records.find(
      (record) => record.id === 'env.publish.access-level.@kitz/core',
    )
    const last = dependent?.proofHistory[dependent.proofHistory.length - 1]
    expect(last?.to).toBe('blocked')
    expect(last?.from).toBe('failed')
    expect(last?.cause).toBe('env.publish.package-access.@kitz/core')
  })

  test('a fully proven plan cascades nothing', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

    expect(proof.records.some((record) => record.blockedBy !== undefined)).toBe(false)
  })

  test('a deferredToHost dependency does not cascade its dependents', () => {
    const proof = makeProofArtifact(oidcDeferredPlan, '2026-05-13T00:00:00.000Z', {
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
    })

    // release-by-tag dependsOn release-permission which is deferredToHost; it
    // must remain its observed status, not cascade to blocked.
    const releaseByTag = proof.records.find(
      (record) => record.id === 'env.github.release-by-tag.@kitz/core@1.0.0',
    )
    expect(releaseByTag?.status).not.toBe('blocked')
    expect(releaseByTag?.blockedBy).toBeUndefined()
  })

  test('a root blocked dependency cascades transitively through the dependency chain', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identityError: 'npm whoami failed',
      packageAccessErrors: { '@kitz/core': 'forbidden' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

    // package-access dependsOn identity (failed) -> package-access cascades to
    // blocked -> access-level dependsOn package-access -> also blocked.
    const packageAccess = proof.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    const accessLevel = proof.records.find(
      (record) => record.id === 'env.publish.access-level.@kitz/core',
    )
    expect(packageAccess?.status).toBe('blocked')
    expect(packageAccess?.blockedBy).toBe('env.publish.identity')
    expect(accessLevel?.status).toBe('blocked')
    expect(accessLevel?.blockedBy).toBe('env.publish.package-access.@kitz/core')
  })
})

describe('soft vs hard proof-gate classification', () => {
  const unprovenProof = () =>
    makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      // identity left unobserved -> env.publish.identity is unprovable.
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

  test('default policy classifies every non-passing record as a hard gate', () => {
    const proof = unprovenProof()
    const issue = validateProof(proof, '2026-05-13T00:00:00.000Z').find(
      (entry) => entry.recordId === 'env.publish.identity',
    )
    expect(issue?.severity).toBe('hard')
    expect(hasBlockingProof(proof)).toBe(true)
  })

  test('a policy listing a status as soft warns but does not block', () => {
    const proof = unprovenProof()
    const policy = updateProofPolicy(defaultProofPolicy(), { softStatuses: ['unprovable'] })
    const issue = validateProof(proof, '2026-05-13T00:00:00.000Z', policy).find(
      (entry) => entry.recordId === 'env.publish.identity',
    )
    expect(issue?.severity).toBe('soft')
    expect(hasBlockingProof(proof, policy)).toBe(false)
  })

  test('a hard record still blocks even when other statuses are soft', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identityError: 'npm whoami failed',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })
    // 'failed' is hard (not in softStatuses); 'unprovable' is soft.
    const policy = updateProofPolicy(defaultProofPolicy(), { softStatuses: ['unprovable'] })
    const failedIssue = validateProof(proof, '2026-05-13T00:00:00.000Z', policy).find(
      (entry) => entry.recordId === 'env.publish.identity',
    )
    expect(failedIssue?.severity).toBe('hard')
    expect(hasBlockingProof(proof, policy)).toBe(true)
  })

  test('missing-dependency and expired issues are always hard regardless of policy', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })
    const altered = updateProofArtifact(proof, {
      records: [
        updateProofRecord(proof.records[1]!, { dependsOn: ['missing-proof'] }),
        updateProofRecord(proof.records[0]!, { expiresAt: '2026-05-13T00:00:00.000Z' }),
      ],
    })
    const policy = updateProofPolicy(defaultProofPolicy(), {
      softStatuses: ['unprovable', 'failed', 'blocked'],
    })
    const issues = validateProof(altered, '2026-05-13T00:00:01.000Z', policy)
    expect(
      issues.find((entry) => entry.code === 'release.proof.missing-dependency')?.severity,
    ).toBe('hard')
    expect(issues.find((entry) => entry.code === 'release.proof.expired')?.severity).toBe('hard')
  })
})

describe('recheckProof honors recheckMode', () => {
  const provenProof = () =>
    makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z', {
      identity: 'octocat',
      packageAccess: { '@kitz/core': 'public' },
      gitPushDryRun: { '@kitz/core@1.0.0': true },
      githubReleasePermission: true,
      githubReleaseExists: { '@kitz/core@1.0.0': false },
    })

  test('pre-apply recheck re-derives pre-apply records from fresh observations', () => {
    const prior = provenProof()
    // package-access is a pre-each-mutation record (NOT pre-apply); identity is
    // a pre-apply record. A pre-apply recheck with a fresh identity failure must
    // flip env.publish.identity but leave pre-each-mutation records untouched.
    const rechecked = recheckProof({
      plan: contractedPlan,
      prior,
      phase: 'pre-apply',
      observations: { identityError: 'token expired', packageAccess: { '@kitz/core': 'public' } },
      now: '2026-05-13T01:00:00.000Z',
    })

    const identity = rechecked.records.find((record) => record.id === 'env.publish.identity')
    expect(identity?.status).toBe('failed')
    // History grew because identity changed proven -> failed.
    expect(identity?.proofHistory.length).toBeGreaterThan(1)
  })

  test('pre-apply recheck does not touch pre-each-mutation records', () => {
    const prior = provenProof()
    const rechecked = recheckProof({
      plan: contractedPlan,
      prior,
      phase: 'pre-apply',
      // fresh observations would flip package-access to failed, but it is a
      // pre-each-mutation record and must be skipped by a pre-apply recheck.
      observations: { identity: 'octocat', packageAccessErrors: { '@kitz/core': 'forbidden' } },
      now: '2026-05-13T01:00:00.000Z',
    })

    const packageAccess = rechecked.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(packageAccess?.status).toBe('proven')
    expect(packageAccess?.proofHistory).toHaveLength(1)
  })

  test('pre-mutation recheck re-derives pre-each-mutation records and appends history', () => {
    const prior = provenProof()
    const rechecked = recheckProof({
      plan: contractedPlan,
      prior,
      phase: 'pre-mutation',
      observations: { identity: 'octocat', packageAccessErrors: { '@kitz/core': 'forbidden' } },
      now: '2026-05-13T01:00:00.000Z',
    })

    const packageAccess = rechecked.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(packageAccess?.status).toBe('failed')
    expect(packageAccess?.proofHistory).toHaveLength(2)
    expect(packageAccess?.proofHistory[1]?.from).toBe('proven')
  })

  test('a clean pre-mutation recheck leaves a proven record unchanged', () => {
    const prior = provenProof()
    const rechecked = recheckProof({
      plan: contractedPlan,
      prior,
      phase: 'pre-mutation',
      observations: {
        identity: 'octocat',
        packageAccess: { '@kitz/core': 'public' },
        gitPushDryRun: { '@kitz/core@1.0.0': true },
      },
      now: '2026-05-13T01:00:00.000Z',
    })

    const packageAccess = rechecked.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(packageAccess?.status).toBe('proven')
    expect(packageAccess?.proofHistory).toHaveLength(1)
  })

  test('an in-phase failure cascades to its out-of-phase dependents', () => {
    const prior = provenProof()
    // identity is a pre-apply record (in-phase); package-access is a
    // pre-each-mutation record (out-of-phase) that dependsOn identity. A
    // pre-apply recheck that fails identity must still cascade package-access to
    // blocked so the rechecked artifact stays internally consistent.
    const rechecked = recheckProof({
      plan: contractedPlan,
      prior,
      phase: 'pre-apply',
      observations: { identityError: 'token expired', packageAccess: { '@kitz/core': 'public' } },
      now: '2026-05-13T01:00:00.000Z',
    })

    const identity = rechecked.records.find((record) => record.id === 'env.publish.identity')
    expect(identity?.status).toBe('failed')

    const packageAccess = rechecked.records.find(
      (record) => record.id === 'env.publish.package-access.@kitz/core',
    )
    expect(packageAccess?.status).toBe('blocked')
    expect(packageAccess?.blockedBy).toBe('env.publish.identity')
    const last = packageAccess?.proofHistory[packageAccess.proofHistory.length - 1]
    expect(last?.to).toBe('blocked')
    expect(last?.from).toBe('proven')
    expect(last?.cause).toBe('env.publish.identity')
  })
})
