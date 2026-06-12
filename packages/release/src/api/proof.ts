import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import {
  Array as A,
  DateTime,
  Effect,
  FileSystem,
  Option,
  Record as EffectRecord,
  Result,
} from 'effect'
import * as ReleaseClock from './clock.js'
import { ProofArtifact, ProofRecord, ProofTransition, type ProofStatus } from './contract/proof.js'
import { Digest } from './digest.js'
import { digestForPlan } from './plan-digest.js'
import type { Plan } from './planner/models/plan.js'
import * as Capability from './publishing/models/capability.js'

export { digestForPlan }

const proofDir = Fs.Path.RelDir.fromString('./.release/proofs/')

/**
 * `readOrEmpty` placeholder only: fails closed — a single `unprovable`
 * record means an accidentally-used empty proof can never validate as
 * releasable.
 */
const emptyProofArtifact = (): ProofArtifact =>
  ProofArtifact.make({
    schemaVersion: 1,
    planDigest: Digest.make({ algorithm: 'sha256', value: '' }),
    records: [
      ProofRecord.make({
        id: 'proof.empty',
        status: 'unprovable',
        dependsOn: [],
        recheckMode: 'pre-apply',
        observedAt: DateTime.makeUnsafe(0),
        evidence: { reason: 'placeholder empty proof artifact' },
        proofHistory: [],
      }),
    ],
  })

const proofResource = Resource.createJson('proof.json', ProofArtifact, emptyProofArtifact())

export interface ProofIssue {
  readonly recordId: string
  readonly code: string
  readonly detail: string
}

/** A git dry-run observation: whether the remote accepted the ref push. */
export interface GitDryRunObservation {
  readonly ok: boolean
  readonly detail?: string
}

export interface ProofObservations {
  readonly now?: DateTime.Utc
  readonly identity?: string
  readonly identityError?: string
  readonly packageAccess?: Readonly<Record<string, 'public' | 'restricted'>>
  readonly packageAccessErrors?: Readonly<Record<string, string>>
  readonly packageVersions?: Readonly<Record<string, boolean>>
  readonly gitPushDryRun?: Readonly<Record<string, GitDryRunObservation>>
  readonly atomicGitPushDryRun?: GitDryRunObservation
  readonly githubReleasePermission?: boolean
  readonly githubReleasePermissionError?: string
  readonly githubReleaseExists?: Readonly<Record<string, boolean>>
  readonly trustedPublisherConfigured?: boolean
  readonly oidcClaimsVerified?: boolean
  readonly provenanceBundleExists?: boolean
}

export const proofPathFor = (cwd: Fs.Path.AbsDir, plan: Plan): Fs.Path.AbsFile =>
  Fs.Path.join(
    Fs.Path.join(cwd, proofDir),
    Fs.Path.RelFile.fromString(`./${digestForPlan(plan).value}.json`),
  )

const transition = (to: ProofStatus, reason: string, at: DateTime.Utc): ProofTransition =>
  ProofTransition.make({ to, at, reason })

const observedRecord = (params: {
  readonly id: string
  readonly status: ProofStatus
  readonly dependsOn: readonly string[]
  readonly now: DateTime.Utc
  readonly reason: string
  readonly evidence: Readonly<Record<string, unknown>>
  readonly recheckMode?: ProofRecord['recheckMode']
}): ProofRecord =>
  ProofRecord.make({
    id: params.id,
    status: params.status,
    dependsOn: [...params.dependsOn],
    recheckMode: params.recheckMode ?? 'pre-apply',
    observedAt: params.now,
    evidence: params.evidence,
    proofHistory: [transition(params.status, params.reason, params.now)],
  })

const capabilityRecord = (params: {
  readonly id: string
  readonly provider: Capability.CapabilityProviderId
  readonly capability: Capability.PublishCapability
  readonly now: DateTime.Utc
}): ProofRecord => {
  const result = Capability.CapabilityMatrixRow.resultForProvider({
    capability: params.capability,
    provider: params.provider,
  })
  const status = result.isSupported ? 'proven' : 'blocked'
  const reason = Capability.Unsupported.is(result)
    ? `provider capability unsupported: ${result.reason}`
    : 'provider capability supported'
  const evidence = Capability.Unsupported.is(result)
    ? {
        capability: result.capability,
        provider: result.provider,
        reason: result.reason,
        evidence: result.evidence,
        blockingPlanFields: result.blockingPlanFields,
      }
    : {
        capability: result.capability,
        provider: result.provider,
        evidence: result.evidence,
      }

  return observedRecord({
    id: params.id,
    status,
    dependsOn: ['plan.publish-intent'],
    now: params.now,
    reason,
    evidence,
  })
}

const capabilityRecordsForPlan = (plan: Plan, now: DateTime.Utc): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []

  const packDriver = plan.publishIntent.profile.packDriver
  const publishInvoker = plan.publishIntent.profile.publishInvoker
  const publishCapabilities: Capability.PublishCapability[] = [
    'publish:tarball',
    'publish:tag',
    'publish:registry',
    'publish:access',
  ]

  if (publishInvoker !== 'bun') {
    publishCapabilities.push('publish:ignore-scripts')
  }
  if (plan.publishIntent.auth.otpPolicy.mode !== 'forbidden') {
    publishCapabilities.push('publish:otp')
  }
  if (plan.publishIntent.provenance.mode === 'cli-flag') {
    publishCapabilities.push('publish:provenance-flag')
  }
  if (plan.publishIntent.provenance.mode === 'attestation-file') {
    publishCapabilities.push('publish:provenance-file')
  }
  if (plan.publishIntent.provenance.mode === 'trusted-publisher') {
    publishCapabilities.push('publish:trusted-oidc')
  }

  return [
    capabilityRecord({
      id: 'capability.pack.tarball',
      provider: packDriver,
      capability: 'pack:tarball',
      now,
    }),
    capabilityRecord({
      id: 'capability.pack.packlist',
      provider: packDriver,
      capability: 'pack:packlist',
      now,
    }),
    ...A.map(publishCapabilities, (capability) =>
      capabilityRecord({
        id: `capability.${capability.replace(':', '.')}`,
        provider: publishInvoker,
        capability,
        now,
      }),
    ),
  ]
}

const releaseSubjectsForPlan = (plan: Plan) =>
  A.map([...plan.releases, ...plan.cascades], (item) => ({
    packageName: item.package.name.moniker,
    version: item.nextVersion.toString(),
    tag: Pkg.Pin.toString(
      Pkg.Pin.Exact.make({
        name: item.package.name,
        version: item.nextVersion,
      }),
    ),
  }))

const credentialRecordsForPlan = (
  plan: Plan,
  now: DateTime.Utc,
  observations: ProofObservations,
): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []

  const intent = plan.publishIntent
  const subjects = releaseSubjectsForPlan(plan)
  const packageRecords = A.flatMap(subjects, (subject) => {
    const name = subject.packageName
    const access = observations.packageAccess?.[name]
    const accessError = observations.packageAccessErrors?.[name]
    const status =
      access !== undefined
        ? intent.access.mode === 'omit' || access === intent.access.value
          ? 'proven'
          : 'failed'
        : accessError !== undefined
          ? 'failed'
          : 'unprovable'
    const statusReason =
      status === 'proven'
        ? 'package access satisfies publish intent'
        : status === 'failed'
          ? (accessError ?? 'package access does not satisfy publish intent')
          : 'package access was not observed'

    return [
      observedRecord({
        id: `env.publish.package-access.${name}`,
        status,
        dependsOn: ['plan.publish-intent', 'env.publish.identity'],
        now,
        reason: statusReason,
        evidence: { packageName: name, access: access ?? null, requested: intent.access },
        recheckMode: 'pre-each-mutation',
      }),
      observedRecord({
        id: `env.publish.access-level.${name}`,
        status:
          intent.access.mode === 'omit'
            ? 'proven'
            : access === undefined
              ? accessError === undefined
                ? 'unprovable'
                : 'failed'
              : access === intent.access.value
                ? 'proven'
                : 'failed',
        dependsOn: [`env.publish.package-access.${name}`],
        now,
        reason:
          intent.access.mode === 'omit'
            ? 'package access flag is intentionally omitted'
            : access === intent.access.value
              ? 'registry access status matches requested publish access'
              : (accessError ?? 'registry access status does not match requested publish access'),
        evidence: { packageName: name, access: access ?? null, requested: intent.access },
        recheckMode: 'pre-each-mutation',
      }),
    ]
  })

  const runtimeHost = intent.auth.runtimeHost
  const otp = intent.auth.otpPolicy
  const unattended = runtimeHost !== 'local-interactive'
  const otpStatus =
    otp.mode === 'forbidden' || otp.mode === 'env' || !unattended ? 'proven' : 'unprovable'
  const identityStatus =
    observations.identity !== undefined
      ? 'proven'
      : observations.identityError !== undefined
        ? 'failed'
        : intent.auth.source === 'trusted-oidc'
          ? 'deferredToHost'
          : 'unprovable'
  const identityReason =
    observations.identity !== undefined
      ? 'publish identity observed'
      : observations.identityError !== undefined
        ? observations.identityError
        : intent.auth.source === 'trusted-oidc'
          ? 'identity is deferred to trusted runtime host'
          : 'local publish identity must be observed by credential provider'

  return [
    observedRecord({
      id: 'env.publish.identity',
      status: identityStatus,
      dependsOn: ['plan.publish-intent'],
      now,
      reason: identityReason,
      evidence: {
        source: intent.auth.source,
        tokenEnv: intent.auth.tokenEnv ?? null,
        identity: observations.identity ?? null,
      },
    }),
    observedRecord({
      id: 'env.publish.mfa-policy',
      status: otpStatus,
      dependsOn: ['plan.publish-intent'],
      now,
      reason:
        otpStatus === 'proven'
          ? 'otp policy cannot hang unattended execution'
          : 'mfa policy cannot be pre-read and unattended execution has no otp source',
      evidence: { otpPolicy: otp, runtimeHost },
    }),
    ...packageRecords,
  ]
}

const sideEffectProofRecordsForPlan = (
  plan: Plan,
  now: DateTime.Utc,
  observations: ProofObservations,
): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []

  const intent = plan.publishIntent
  const subjects = releaseSubjectsForPlan(plan)
  const gitRecords = A.map(subjects, (subject) => {
    const proof = observations.gitPushDryRun?.[subject.tag]
    const status = proof === undefined ? 'unprovable' : proof.ok ? 'proven' : 'failed'
    return observedRecord({
      id: `env.git.push-dry-run.${subject.tag}`,
      status,
      dependsOn: ['plan.publish-intent'],
      now,
      reason:
        status === 'proven'
          ? 'git dry-run push accepted the tag ref'
          : status === 'failed'
            ? 'git dry-run push rejected the tag ref'
            : 'git dry-run push was not observed',
      evidence: {
        tag: subject.tag,
        remote: intent.git.remote,
        ...(proof === undefined
          ? { observed: false }
          : { ok: proof.ok, detail: proof.detail ?? null }),
      },
      recheckMode: 'pre-each-mutation',
    })
  })

  const atomicProof = observations.atomicGitPushDryRun
  const atomicRecord =
    intent.git.atomicTagPush && subjects.length > 1
      ? [
          observedRecord({
            id: 'env.git.push-dry-run.atomic',
            status: atomicProof === undefined ? 'unprovable' : atomicProof.ok ? 'proven' : 'failed',
            dependsOn: A.map(gitRecords, (record) => record.id),
            now,
            reason:
              atomicProof?.ok === true
                ? 'git dry-run accepted atomic multi-tag push'
                : 'git dry-run did not prove atomic multi-tag push',
            evidence: {
              tags: A.map(subjects, (subject) => subject.tag),
              remote: intent.git.remote,
              ...(atomicProof === undefined
                ? { observed: false }
                : { ok: atomicProof.ok, detail: atomicProof.detail ?? null }),
            },
            recheckMode: 'pre-each-mutation',
          }),
        ]
      : []

  const releasePermissionStatus =
    observations.githubReleasePermission === true
      ? 'proven'
      : observations.githubReleasePermission === false
        ? 'failed'
        : intent.auth.runtimeHost === 'github-actions'
          ? 'deferredToHost'
          : 'unprovable'

  const githubRecords = [
    observedRecord({
      id: 'env.github.release-permission',
      status: releasePermissionStatus,
      dependsOn: ['plan.publish-intent'],
      now,
      reason:
        releasePermissionStatus === 'proven'
          ? 'github release permission was observed'
          : releasePermissionStatus === 'failed'
            ? (observations.githubReleasePermissionError ?? 'github release permission failed')
            : releasePermissionStatus === 'deferredToHost'
              ? 'github release permission is deferred to the named GitHub Actions runtime'
              : 'github release permission could not be proven locally',
      evidence: {
        repository: intent.github.repository,
        host: intent.github.host.apiUrl,
        permission: observations.githubReleasePermission ?? null,
      },
      recheckMode: 'pre-apply-and-on-mutation-failure',
    }),
    ...A.map(subjects, (subject) =>
      observedRecord({
        id: `env.github.release-by-tag.${subject.tag}`,
        status:
          observations.githubReleaseExists?.[subject.tag] === undefined ? 'unprovable' : 'proven',
        dependsOn: ['env.github.release-permission'],
        now,
        reason:
          observations.githubReleaseExists?.[subject.tag] === undefined
            ? 'github release-by-tag state was not observed'
            : 'github release-by-tag state was observed',
        evidence: {
          tag: subject.tag,
          exists: observations.githubReleaseExists?.[subject.tag] ?? null,
          existingReleasePolicy: intent.github.existingReleasePolicy,
        },
        recheckMode: 'pre-apply-and-on-mutation-failure',
      }),
    ),
  ]

  return [...gitRecords, ...atomicRecord, ...githubRecords]
}

const provenanceRecordForPlan = (
  plan: Plan,
  now: DateTime.Utc,
  observations: ProofObservations,
): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []
  const intent = plan.publishIntent
  const mode = intent.provenance.mode

  if (!intent.provenance.required && mode === 'none') {
    return [
      observedRecord({
        id: 'publish.provenance-policy',
        status: 'proven',
        dependsOn: ['plan.publish-intent'],
        now,
        reason: 'provenance is not required for this plan',
        evidence: { mode, required: false },
      }),
    ]
  }

  if (intent.profile.publishInvoker === 'bun' && intent.provenance.required) {
    return [
      observedRecord({
        id: 'publish.provenance-policy',
        status: 'blocked',
        dependsOn: ['plan.publish-intent'],
        now,
        reason: 'bun publish has no documented provenance support',
        evidence: { mode, required: true, invoker: 'bun' },
      }),
    ]
  }

  if (mode === 'trusted-publisher') {
    const trusted =
      intent.provenance.provider === 'npm-circleci'
        ? !intent.provenance.required
        : observations.trustedPublisherConfigured === true &&
          observations.oidcClaimsVerified === true
    return [
      observedRecord({
        id: 'publish.provenance-policy',
        status: trusted ? 'proven' : 'unprovable',
        dependsOn: ['plan.publish-intent', 'env.publish.identity'],
        now,
        reason: trusted
          ? 'trusted-publisher provenance policy is satisfied'
          : 'trusted-publisher provenance proof is missing',
        evidence: {
          mode,
          required: intent.provenance.required,
          provider: intent.provenance.provider ?? null,
          trustedPublisherConfigured: observations.trustedPublisherConfigured ?? null,
          oidcClaimsVerified: observations.oidcClaimsVerified ?? null,
        },
      }),
    ]
  }

  if (mode === 'attestation-file') {
    return [
      observedRecord({
        id: 'publish.provenance-policy',
        status: observations.provenanceBundleExists === true ? 'proven' : 'unprovable',
        dependsOn: ['plan.publish-intent'],
        now,
        reason:
          observations.provenanceBundleExists === true
            ? 'attestation file exists'
            : 'attestation file was not observed',
        evidence: {
          file: intent.provenance.file ? Fs.Path.toString(intent.provenance.file) : null,
        },
      }),
    ]
  }

  return [
    observedRecord({
      id: 'publish.provenance-policy',
      status: 'proven',
      dependsOn: ['plan.publish-intent'],
      now,
      reason: 'provider capability proves explicit provenance mode',
      evidence: { mode, required: intent.provenance.required },
    }),
  ]
}

export const makeProofArtifact = (
  plan: Plan,
  now: DateTime.Utc,
  observations: ProofObservations = {},
): ProofArtifact => {
  const observedAt = observations.now ?? now
  const records = [
    observedRecord({
      id: 'plan.digest',
      status: plan.planDigest === undefined ? 'unprovable' : 'proven',
      dependsOn: [],
      now: observedAt,
      reason: 'plan digest checked',
      evidence:
        plan.planDigest === undefined
          ? { reason: 'plan has no frozen digest' }
          : { digest: plan.planDigest.value },
    }),
    observedRecord({
      id: 'plan.publish-intent',
      status: plan.publishIntent === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      now: observedAt,
      reason: 'publish intent checked',
      evidence:
        plan.publishIntent === undefined
          ? { reason: 'plan has no frozen publish intent' }
          : {
              profile: plan.publishIntent.profile.id,
              registry: plan.publishIntent.registry.url,
              distTag: plan.publishIntent.distTag,
            },
    }),
    observedRecord({
      id: 'plan.source',
      status: plan.source === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      now: observedAt,
      reason: 'source snapshot checked',
      evidence:
        plan.source === undefined
          ? { reason: 'plan has no source snapshot' }
          : {
              headSha: plan.source.headSha,
              configDigest: plan.source.releaseConfigDigest.value,
              packageManager: plan.source.packageManager,
            },
    }),
    ...capabilityRecordsForPlan(plan, observedAt),
    ...credentialRecordsForPlan(plan, observedAt, observations),
    ...sideEffectProofRecordsForPlan(plan, observedAt, observations),
    ...provenanceRecordForPlan(plan, observedAt, observations),
  ]

  return ProofArtifact.make({
    schemaVersion: 1,
    planDigest: digestForPlan(plan),
    records,
  })
}

const subjectObservationConcurrency = 4

export const collectLocalObservations = (
  plan: Plan,
): Effect.Effect<ProofObservations, never, Git.Git | NpmRegistry.NpmCli> =>
  Effect.gen(function* () {
    if (plan.publishIntent === undefined) return {}

    const intent = plan.publishIntent
    const cli = yield* NpmRegistry.NpmCli
    const git = yield* Git.Git
    const registry = intent.registry.url
    const subjects = releaseSubjectsForPlan(plan)
    const identityResult = yield* cli.whoami({ registry }).pipe(Effect.result)
    const identity = Result.isSuccess(identityResult) ? identityResult.success : undefined
    const identityError = Result.isFailure(identityResult)
      ? Err.ensure(identityResult.failure).message
      : undefined

    const subjectObservations = yield* Effect.forEach(
      subjects,
      (subject) =>
        Effect.gen(function* () {
          const accessResult = yield* cli
            .getAccessStatus(subject.packageName, { registry })
            .pipe(Effect.result)
          const access: {
            readonly access?: 'public' | 'restricted'
            readonly accessError?: string
          } = Result.match(accessResult, {
            onSuccess: (status) =>
              status === 'public' || status === 'restricted'
                ? { access: status }
                : { accessError: `npm access status is ${status}, not public or restricted` },
            onFailure: (failure) => ({ accessError: Err.ensure(failure).message }),
          })

          const gitResult = yield* git
            .pushTagDryRun(subject.tag, intent.git.remote, intent.forcePushTag)
            .pipe(Effect.result)
          const gitPushDryRun = Result.match(gitResult, {
            onSuccess: (success): GitDryRunObservation => ({ ok: true, detail: success.stdout }),
            onFailure: (failure): GitDryRunObservation => ({
              ok: false,
              detail: Err.ensure(failure).message,
            }),
          })

          return { subject, ...access, gitPushDryRun }
        }),
      { concurrency: subjectObservationConcurrency },
    )

    const packageAccess = EffectRecord.fromEntries(
      subjectObservations.flatMap((observation) =>
        observation.access !== undefined
          ? [[observation.subject.packageName, observation.access] as const]
          : [],
      ),
    )
    const packageAccessErrors = EffectRecord.fromEntries(
      subjectObservations.flatMap((observation) =>
        observation.accessError !== undefined
          ? [[observation.subject.packageName, observation.accessError] as const]
          : [],
      ),
    )
    const gitPushDryRun = EffectRecord.fromEntries(
      subjectObservations.map(
        (observation) => [observation.subject.tag, observation.gitPushDryRun] as const,
      ),
    )

    const atomicGitPushDryRun =
      intent.git.atomicTagPush && subjects.length > 1
        ? yield* git
            .pushTagsAtomicDryRun(
              A.map(subjects, (subject) => subject.tag),
              intent.git.remote,
              intent.forcePushTag,
            )
            .pipe(
              Effect.result,
              Effect.map((result) =>
                Result.match(result, {
                  onSuccess: (success): GitDryRunObservation => ({
                    ok: true,
                    detail: success.stdout,
                  }),
                  onFailure: (failure): GitDryRunObservation => ({
                    ok: false,
                    detail: Err.ensure(failure).message,
                  }),
                }),
              ),
            )
        : undefined

    return {
      ...(identity !== undefined ? { identity } : {}),
      ...(identityError !== undefined ? { identityError } : {}),
      ...(Object.keys(packageAccess).length > 0 ? { packageAccess } : {}),
      ...(Object.keys(packageAccessErrors).length > 0 ? { packageAccessErrors } : {}),
      ...(Object.keys(gitPushDryRun).length > 0 ? { gitPushDryRun } : {}),
      ...(atomicGitPushDryRun !== undefined ? { atomicGitPushDryRun } : {}),
    }
  })

export const collectGithubObservations = (
  plan: Plan,
): Effect.Effect<ProofObservations, never, Github.Github> =>
  Effect.gen(function* () {
    if (plan.publishIntent === undefined) return {}

    const github = yield* Github.Github
    const observed = yield* Effect.forEach(
      releaseSubjectsForPlan(plan),
      (subject) =>
        github.releaseExists(subject.tag).pipe(
          Effect.result,
          Effect.map((result) =>
            Result.isSuccess(result) ? [[subject.tag, result.success] as const] : [],
          ),
        ),
      { concurrency: subjectObservationConcurrency },
    )
    const githubReleaseExists = EffectRecord.fromEntries(observed.flat())

    return Object.keys(githubReleaseExists).length > 0 ? { githubReleaseExists } : {}
  })

export const hasBlockingProof = (proof: ProofArtifact, now: DateTime.Utc): boolean =>
  validateProof(proof, now).length > 0

export const validateProof = (proof: ProofArtifact, now: DateTime.Utc): readonly ProofIssue[] => {
  const ids = A.map(proof.records, (record) => record.id)
  const blocking = A.map(
    A.filter(
      proof.records,
      (record) => record.status !== 'proven' && record.status !== 'deferredToHost',
    ),
    (record): ProofIssue => ({
      recordId: record.id,
      code: `release.proof.${record.status}`,
      detail: `Proof record ${record.id} is ${record.status}.`,
    }),
  )

  const missingDependencies = A.flatMap(proof.records, (record) =>
    A.map(
      A.filter(record.dependsOn, (dependency) => !A.contains(ids, dependency)),
      (dependency): ProofIssue => ({
        recordId: record.id,
        code: 'release.proof.missing-dependency',
        detail: `Proof record ${record.id} depends on missing record ${dependency}.`,
      }),
    ),
  )

  const expired = A.flatMap(proof.records, (record): ProofIssue[] =>
    record.expiresAt !== undefined && DateTime.isLessThanOrEqualTo(record.expiresAt, now)
      ? [
          {
            recordId: record.id,
            code: 'release.proof.expired',
            detail: `Proof record ${record.id} expired at ${DateTime.formatIso(record.expiresAt)}.`,
          },
        ]
      : [],
  )

  return [...blocking, ...missingDependencies, ...expired]
}

export const write = (
  proof: ProofArtifact,
  path: Fs.Path.AbsFile,
): Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem> =>
  proofResource.write(proof, path)

export const read = (
  path: Fs.Path.AbsFile,
): Effect.Effect<Option.Option<ProofArtifact>, Resource.ResourceError, FileSystem.FileSystem> =>
  proofResource.read(path)

export const prove = (
  plan: Plan,
  observations: ProofObservations = {},
): Effect.Effect<ProofArtifact, Resource.ResourceError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const now = yield* ReleaseClock.now
    const proof = makeProofArtifact(plan, now, observations)
    yield* write(proof, proofPathFor(env.cwd, plan))
    return proof
  })

export const readForPlan = (
  plan: Plan,
): Effect.Effect<
  Option.Option<ProofArtifact>,
  Resource.ResourceError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    return yield* read(proofPathFor(env.cwd, plan))
  })
