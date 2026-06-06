import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import {
  Array as A,
  Clock,
  Effect,
  FileSystem,
  MutableHashMap,
  Option,
  PlatformError,
  Result,
  Schema,
} from 'effect'
import { sha256Json } from './digest.js'
import type { Plan } from './planner/models/plan.js'
import * as Capability from './publishing/models/capability.js'
import {
  DeferredProof,
  defaultProofPolicy,
  PlanDigest,
  ProofArtifact,
  ProofPolicy,
  ProofRecord,
  ProofTransition,
  RuntimeHost,
  type ProofGateClass,
  type ProofStatus,
} from './release-contract.js'

const proofDir = Fs.Path.RelDir.fromString('./.release/proofs/')

export interface ProofIssue {
  readonly recordId: string
  readonly code: string
  readonly detail: string
  readonly severity: ProofGateClass
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
        runtimeHost,
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
        runtimeHost: intent.auth.runtimeHost,
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

/**
 * Cascade `blocked` status through the `dependsOn` DAG. A record whose any
 * dependency resolves to `failed` or `blocked` is itself flipped to `blocked`,
 * gains a `blockedBy` reference to the first such dependency (the root cause),
 * and appends a `ProofTransition` carrying `from` (its pre-cascade status) and
 * `cause` (the root-cause id). `deferredToHost` dependencies are pass states
 * and do not cascade.
 *
 * Records are constructed parent-before-child, so a single forward pass with a
 * resolved-status map propagates the cascade transitively (a record blocked by
 * cascade is itself a blocking dependency for its later dependents).
 */
const cascadeBlocked = (records: readonly ProofRecord[], now: string): ProofRecord[] => {
  const statusById = MutableHashMap.empty<string, ProofStatus>()
  return A.map(records, (record) => {
    const blockingDependency = A.findFirst(record.dependsOn, (dependencyId) => {
      const dependencyStatus = MutableHashMap.get(statusById, dependencyId)
      return Option.exists(
        dependencyStatus,
        (status) => status === 'failed' || status === 'blocked',
      )
    })

    if (Option.isNone(blockingDependency) || record.status === 'blocked') {
      MutableHashMap.set(statusById, record.id, record.status)
      return record
    }

    const cause = blockingDependency.value
    const causeStatus = Option.getOrElse(
      MutableHashMap.get(statusById, cause),
      (): ProofStatus => 'blocked',
    )
    MutableHashMap.set(statusById, record.id, 'blocked')
    return ProofRecord.make({
      ...record,
      status: 'blocked',
      blockedBy: cause,
      proofHistory: [
        ...record.proofHistory,
        ProofTransition.make({
          from: record.status,
          to: 'blocked',
          at: now,
          reason: `dependency ${cause} is ${causeStatus}`,
          cause,
        }),
      ],
    })
  })
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
    schemaVersion: 2,
    planDigest: digestForPlan(plan),
    records: cascadeBlocked(records, observedAt),
  })
}

/**
 * Project the host-delegated proof records (status `deferredToHost`) of an
 * artifact into structured {@link DeferredProof} records. The status literal
 * and the structured projection are deliberately kept distinct: the record
 * carries the `deferredToHost` status, this projection carries the host the
 * proof is delegated to (read from the record's `runtimeHost` evidence).
 */
const isRuntimeHost = Schema.is(RuntimeHost)

export const deferredProofsForArtifact = (proof: ProofArtifact): readonly DeferredProof[] =>
  A.filterMap(proof.records, (record) => {
    if (record.status !== 'deferredToHost') return Result.failVoid
    const runtimeHost = record.evidence['runtimeHost']
    if (!isRuntimeHost(runtimeHost)) return Result.failVoid
    const lastTransition = record.proofHistory[record.proofHistory.length - 1]
    return Result.succeed(
      DeferredProof.make({
        recordId: record.id,
        deferredTo: runtimeHost,
        reason: lastTransition?.reason ?? '',
        observedAt: record.observedAt,
      }),
    )
  })

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

export const hasBlockingProof = (
  proof: ProofArtifact,
  policy: ProofPolicy = defaultProofPolicy(),
): boolean => A.some(validateProof(proof, undefined, policy), (issue) => issue.severity === 'hard')

export const validateProof = (
  proof: ProofArtifact,
  now: string = new Date().toISOString(),
  policy: ProofPolicy = defaultProofPolicy(),
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
      severity: A.contains(policy.softStatuses, record.status) ? 'soft' : 'hard',
    }),
  )

  const missingDependencies = A.flatMap(proof.records, (record) =>
    A.map(
      A.filter(record.dependsOn, (dependency) => !A.contains(ids, dependency)),
      (dependency): ProofIssue => ({
        recordId: record.id,
        code: 'release.proof.missing-dependency',
        detail: `Proof record ${record.id} depends on missing record ${dependency}.`,
        severity: 'hard',
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
      severity: 'hard',
    }),
  )

  return [...blocking, ...missingDependencies, ...expired]
}

export const write = (
  proof: ProofArtifact,
  path: Fs.Path.AbsFile,
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(path)), { recursive: true })
    yield* fs.writeFileString(
      Fs.Path.toString(path),
      `${JSON.stringify(Schema.encodeSync(ProofArtifact)(proof), null, 2)}\n`,
    )
  })

export const read = (
  path: Fs.Path.AbsFile,
): Effect.Effect<
  Option.Option<ProofArtifact>,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(Fs.Path.toString(path))
    if (!exists) return Option.none()
    const text = yield* fs.readFileString(Fs.Path.toString(path))
    const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ProofArtifact))(text)
    return Option.some(decoded)
  })

const lastTransitionStatus = (record: ProofRecord): ProofStatus | undefined =>
  record.proofHistory[record.proofHistory.length - 1]?.to

/**
 * Merge a freshly observed proof artifact onto a prior one, growing
 * `proofHistory` per record id rather than overwriting it. For each fresh
 * record that has a matching prior record, the prior history is carried forward
 * and the fresh record's latest transition is appended only when the status
 * actually changed since the prior's last transition (re-proving with no change
 * appends nothing). Records absent from the prior keep their fresh
 * single-element history.
 */
export const mergeProofHistory = (prior: ProofArtifact, fresh: ProofArtifact): ProofArtifact => {
  const priorById = MutableHashMap.fromIterable(
    A.map(prior.records, (record) => [record.id, record] as const),
  )

  return ProofArtifact.make({
    ...fresh,
    records: A.map(fresh.records, (freshRecord) => {
      const priorRecordOption = MutableHashMap.get(priorById, freshRecord.id)
      if (Option.isNone(priorRecordOption)) return freshRecord
      const priorRecord = priorRecordOption.value

      const statusUnchanged = lastTransitionStatus(priorRecord) === freshRecord.status
      const latestFresh = freshRecord.proofHistory[freshRecord.proofHistory.length - 1]
      const appended =
        statusUnchanged || latestFresh === undefined
          ? []
          : [ProofTransition.make({ ...latestFresh, from: priorRecord.status })]

      return ProofRecord.make({
        ...freshRecord,
        proofHistory: [...priorRecord.proofHistory, ...appended],
      })
    }),
  })
}

/**
 * The mutation phases at which `recheckMode` requests a fresh proof. Each phase
 * targets the subset of records whose `recheckMode` opts into that phase.
 */
export type RecheckPhase = 'pre-apply' | 'pre-mutation' | 'on-mutation-failure'

const recheckModesForPhase = (phase: RecheckPhase): readonly ProofRecord['recheckMode'][] => {
  switch (phase) {
    case 'pre-apply':
      return ['pre-apply', 'pre-apply-and-on-mutation-failure']
    case 'pre-mutation':
      return ['pre-each-mutation']
    case 'on-mutation-failure':
      return ['pre-apply-and-on-mutation-failure']
  }
}

/**
 * Re-derive only the proof records whose `recheckMode` opts into the given
 * mutation `phase`, from fresh observations, and merge them onto the prior
 * artifact. Records outside the phase keep their prior status and history;
 * records inside the phase take their freshly observed status and grow their
 * history via {@link mergeProofHistory} (so a status flip is recorded, an
 * unchanged status appends nothing). This is the proof-blind recheck primitive
 * the apply boundary and any executor mutation hook drive to honor
 * `recheckMode`.
 */
export const recheckProof = (params: {
  readonly plan: Plan
  readonly prior: ProofArtifact
  readonly phase: RecheckPhase
  readonly observations: ProofObservations
  readonly now: string
}): ProofArtifact => {
  const targetModes = recheckModesForPhase(params.phase)
  const fresh = makeProofArtifact(params.plan, params.now, params.observations)
  const freshById = MutableHashMap.fromIterable(
    A.map(fresh.records, (record) => [record.id, record] as const),
  )

  // Build a hybrid fresh artifact: in-phase records take the freshly observed
  // record, out-of-phase records keep the prior record verbatim.
  const hybridRecords = A.map(params.prior.records, (priorRecord) => {
    if (!A.contains(targetModes, priorRecord.recheckMode)) return priorRecord
    return Option.getOrElse(MutableHashMap.get(freshById, priorRecord.id), () => priorRecord)
  })

  // Re-run the cascade over the hybrid set so a freshly failed in-phase record
  // blocks its dependents regardless of their phase. Without this, an
  // out-of-phase dependent of a freshly failed dependency keeps its stale prior
  // status, producing an internally inconsistent artifact (a `proven` record
  // whose dependency is `failed`). Already-blocked records are skipped by
  // `cascadeBlocked`, so fresh in-phase records that cascaded inside
  // `makeProofArtifact` are not re-transitioned. Then merge history against the
  // prior so only records whose status actually changed grow their history.
  const cascadedRecords = cascadeBlocked(hybridRecords, params.now)

  return mergeProofHistory(
    params.prior,
    ProofArtifact.make({ ...params.prior, records: cascadedRecords }),
  )
}

export const prove = (
  plan: Plan,
  observations: ProofObservations = {},
): Effect.Effect<ProofArtifact, PlatformError.PlatformError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const now = yield* Clock.currentTimeMillis
    const fresh = makeProofArtifact(plan, new Date(now).toISOString(), observations)
    const path = proofPathFor(env.cwd, plan)
    const prior = yield* read(path).pipe(Effect.orElseSucceed(() => Option.none<ProofArtifact>()))
    const merged = Option.match(prior, {
      onNone: () => fresh,
      onSome: (priorProof) => mergeProofHistory(priorProof, fresh),
    })
    yield* write(merged, path)
    return merged
  })

export const readForPlan = (
  plan: Plan,
): Effect.Effect<
  Option.Option<ProofArtifact>,
  PlatformError.PlatformError | Schema.SchemaError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    return yield* read(proofPathFor(env.cwd, plan))
  })
