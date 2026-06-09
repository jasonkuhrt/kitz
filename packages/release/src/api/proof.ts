import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Array as A, Clock, Effect, FileSystem, Option, Result, Schema } from 'effect'
import { sha256Json } from './digest.js'
import { jsonFile } from './persistence.js'
import type { Plan } from './planner/models/plan.js'
import * as Capability from './publishing/models/capability.js'
import {
  PlanDigest,
  ProofArtifact,
  ProofRecord,
  ProofTransition,
  type ProofStatus,
} from './release-contract.js'

const proofDir = Fs.Path.RelDir.fromString('./.release/proofs/')
const proofResource = jsonFile(ProofArtifact)

export interface ProofIssue {
  readonly recordId: string
  readonly code: string
  readonly detail: string
}

export interface ProofObservations {
  readonly now?: string
  readonly identity?: string
  readonly identityError?: string
  readonly packageAccess?: Readonly<Record<string, 'public' | 'restricted'>>
  readonly packageAccessErrors?: Readonly<Record<string, string>>
  readonly packageVersions?: Readonly<Record<string, boolean>>
  readonly gitPushDryRun?: Readonly<
    Record<string, boolean | { readonly ok: boolean; readonly detail?: string }>
  >
  readonly atomicGitPushDryRun?: boolean | { readonly ok: boolean; readonly detail?: string }
  readonly githubReleasePermission?: boolean
  readonly githubReleasePermissionError?: string
  readonly githubReleaseExists?: Readonly<Record<string, boolean>>
  readonly trustedPublisherConfigured?: boolean
  readonly oidcClaimsVerified?: boolean
  readonly provenanceBundleExists?: boolean
}

export const digestForPlan = (plan: Plan): PlanDigest =>
  plan.planDigest ?? PlanDigest.make(sha256Json(Schema.encodeSync(PlanForDigest)(plan)))

const PlanForDigest = Schema.Struct({
  lifecycle: Schema.String,
  timestamp: Schema.String,
  releases: Schema.Array(Schema.Unknown),
  cascades: Schema.Array(Schema.Unknown),
})

export const proofPathFor = (cwd: Fs.Path.AbsDir, plan: Plan): Fs.Path.AbsFile =>
  Fs.Path.join(
    Fs.Path.join(cwd, proofDir),
    Fs.Path.RelFile.fromString(`./${digestForPlan(plan).value}.json`),
  )

const transition = (to: ProofStatus, reason: string, at: string): ProofTransition =>
  ProofTransition.make({ to, at, reason })

const observedRecord = (params: {
  readonly id: string
  readonly status: ProofStatus
  readonly dependsOn: readonly string[]
  readonly now: string
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
  readonly now: string
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

  return ProofRecord.make({
    id: params.id,
    status,
    dependsOn: ['plan.publish-intent'],
    recheckMode: 'pre-apply',
    observedAt: params.now,
    evidence,
    proofHistory: [transition(status, reason, params.now)],
  })
}

const capabilityRecordsForPlan = (plan: Plan, now: string): ProofRecord[] => {
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

const gitDryRunStatus = (
  value: boolean | { readonly ok: boolean; readonly detail?: string } | undefined,
): ProofStatus => {
  if (value === undefined) return 'unprovable'
  return (typeof value === 'boolean' ? value : value.ok) ? 'proven' : 'failed'
}

const gitDryRunEvidence = (
  value: boolean | { readonly ok: boolean; readonly detail?: string } | undefined,
): Readonly<Record<string, unknown>> => {
  if (value === undefined) return { observed: false }
  return typeof value === 'boolean' ? { ok: value } : { ok: value.ok, detail: value.detail ?? null }
}

const credentialRecordsForPlan = (
  plan: Plan,
  now: string,
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
  now: string,
  observations: ProofObservations,
): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []

  const intent = plan.publishIntent
  const subjects = releaseSubjectsForPlan(plan)
  const gitRecords = A.map(subjects, (subject) => {
    const proof = observations.gitPushDryRun?.[subject.tag]
    const status = gitDryRunStatus(proof)
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
        ...gitDryRunEvidence(proof),
      },
      recheckMode: 'pre-each-mutation',
    })
  })

  const atomicRecord =
    intent.git.atomicTagPush && subjects.length > 1
      ? [
          observedRecord({
            id: 'env.git.push-dry-run.atomic',
            status: gitDryRunStatus(observations.atomicGitPushDryRun),
            dependsOn: A.map(gitRecords, (record) => record.id),
            now,
            reason:
              gitDryRunStatus(observations.atomicGitPushDryRun) === 'proven'
                ? 'git dry-run accepted atomic multi-tag push'
                : 'git dry-run did not prove atomic multi-tag push',
            evidence: {
              tags: A.map(subjects, (subject) => subject.tag),
              remote: intent.git.remote,
              ...gitDryRunEvidence(observations.atomicGitPushDryRun),
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
  now: string,
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
  now: string = new Date().toISOString(),
  observations: ProofObservations = {},
): ProofArtifact => {
  const observedAt = observations.now ?? now
  const records = [
    ProofRecord.make({
      id: 'plan.digest',
      status: plan.planDigest === undefined ? 'unprovable' : 'proven',
      dependsOn: [],
      recheckMode: 'pre-apply',
      observedAt,
      evidence:
        plan.planDigest === undefined
          ? { reason: 'plan has no frozen digest' }
          : { digest: plan.planDigest.value },
      proofHistory: [
        transition(
          plan.planDigest === undefined ? 'unprovable' : 'proven',
          'plan digest checked',
          observedAt,
        ),
      ],
    }),
    ProofRecord.make({
      id: 'plan.publish-intent',
      status: plan.publishIntent === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      recheckMode: 'pre-apply',
      observedAt,
      evidence:
        plan.publishIntent === undefined
          ? { reason: 'plan has no frozen publish intent' }
          : {
              profile: plan.publishIntent.profile.id,
              registry: plan.publishIntent.registry.url,
              distTag: plan.publishIntent.distTag,
            },
      proofHistory: [
        transition(
          plan.publishIntent === undefined ? 'unprovable' : 'proven',
          'publish intent checked',
          observedAt,
        ),
      ],
    }),
    ProofRecord.make({
      id: 'plan.source',
      status: plan.source === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      recheckMode: 'pre-apply',
      observedAt,
      evidence:
        plan.source === undefined
          ? { reason: 'plan has no source snapshot' }
          : {
              headSha: plan.source.headSha,
              configDigest: plan.source.releaseConfigDigest.value,
              packageManager: plan.source.packageManager,
            },
      proofHistory: [
        transition(
          plan.source === undefined ? 'unprovable' : 'proven',
          'source snapshot checked',
          observedAt,
        ),
      ],
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
      ? identityResult.failure instanceof Error
        ? identityResult.failure.message
        : String(identityResult.failure)
      : undefined
    const packageAccess: Record<string, 'public' | 'restricted'> = {}
    const packageAccessErrors: Record<string, string> = {}
    const gitPushDryRun: Record<string, { ok: boolean; detail?: string }> = {}

    for (const subject of subjects) {
      const accessResult = yield* cli
        .getAccessStatus(subject.packageName, { registry })
        .pipe(Effect.result)
      if (
        Result.isSuccess(accessResult) &&
        (accessResult.success === 'public' || accessResult.success === 'restricted')
      ) {
        packageAccess[subject.packageName] = accessResult.success
      } else if (Result.isSuccess(accessResult)) {
        packageAccessErrors[subject.packageName] =
          `npm access status is ${accessResult.success}, not public or restricted`
      } else {
        packageAccessErrors[subject.packageName] =
          accessResult.failure instanceof Error
            ? accessResult.failure.message
            : String(accessResult.failure)
      }

      const gitResult = yield* git
        .pushTagDryRun(subject.tag, intent.git.remote, intent.forcePushTag)
        .pipe(Effect.result)
      gitPushDryRun[subject.tag] = Result.match(gitResult, {
        onSuccess: (success) => ({ ok: true, detail: success.stdout }),
        onFailure: (failure) => ({
          ok: false,
          detail: failure instanceof Error ? failure.message : String(failure),
        }),
      })
    }

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
                  onSuccess: (success) => ({ ok: true, detail: success.stdout }),
                  onFailure: (failure) => ({
                    ok: false,
                    detail: failure instanceof Error ? failure.message : String(failure),
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
    const githubReleaseExists: Record<string, boolean> = {}

    for (const subject of releaseSubjectsForPlan(plan)) {
      const result = yield* github.releaseExists(subject.tag).pipe(Effect.result)
      if (Result.isSuccess(result)) {
        githubReleaseExists[subject.tag] = result.success
      }
    }

    return Object.keys(githubReleaseExists).length > 0 ? { githubReleaseExists } : {}
  })

export const hasBlockingProof = (proof: ProofArtifact): boolean => validateProof(proof).length > 0

export const validateProof = (
  proof: ProofArtifact,
  now: string = new Date().toISOString(),
): readonly ProofIssue[] => {
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

  const expired = A.map(
    A.filter(
      proof.records,
      (record) => record.expiresAt !== undefined && Date.parse(record.expiresAt) <= Date.parse(now),
    ),
    (record): ProofIssue => ({
      recordId: record.id,
      code: 'release.proof.expired',
      detail: `Proof record ${record.id} expired at ${record.expiresAt}.`,
    }),
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
    const now = yield* Clock.currentTimeMillis
    const proof = makeProofArtifact(plan, new Date(now).toISOString(), observations)
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
