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
  HashSet,
  MutableHashMap,
  Option,
  PlatformError,
  Result,
  Schema,
} from 'effect'
import * as Explorer from './explorer/__.js'
import type { Plan } from './planner/models/plan.js'
import * as Capability from './publishing/models/capability.js'
import {
  DeferredProof,
  defaultProofPolicy,
  digestForPlan,
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
}): ProofRecord =>
  ProofRecord.make({
    id: params.id,
    status: params.status,
    dependsOn: [...params.dependsOn],
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
          provenanceBundleExists: observations.provenanceBundleExists ?? null,
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
 * cascade is itself a blocking dependency for its later dependents). This
 * forward-pass correctness rests on a topological invariant: every dependency
 * id that is itself present in the record set must be constructed *before* the
 * record that depends on it. A forward reference (a dependency present in the
 * set but not yet resolved when its dependent is visited) would silently read
 * as non-blocking and skip a cascade that should fire — the exact "hidden
 * fallback that makes data loss look successful" the correctness policy forbids.
 * The guard below fails loud on such mis-ordering instead. Dependencies that are
 * genuinely absent from the set are not this function's concern — `validateProof`
 * reports them as `missing-dependency`.
 */
const cascadeBlocked = (records: readonly ProofRecord[], now: string): ProofRecord[] => {
  const idsInSet = HashSet.fromIterable(A.map(records, (record) => record.id))
  const statusById = MutableHashMap.empty<string, ProofStatus>()
  return A.map(records, (record) => {
    for (const dependencyId of record.dependsOn) {
      if (
        HashSet.has(idsInSet, dependencyId) &&
        Option.isNone(MutableHashMap.get(statusById, dependencyId))
      ) {
        throw new Error(
          `Proof cascade invariant violated: record ${record.id} depends on ${dependencyId}, ` +
            `which is present in the artifact but constructed after it. The blocked-cascade is a ` +
            `single forward pass and requires dependencies to precede their dependents; reorder the ` +
            `record construction so ${dependencyId} comes before ${record.id}.`,
        )
      }
    }

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
      // oxlint-disable-next-line typescript/no-misused-spread -- field bag for .make(), which rebuilds the Schema.Class instance with overrides
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
    schemaVersion: 3,
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

/**
 * Collect the full observation set for a plan: local credential/registry/git
 * surfaces plus GitHub release surfaces. GitHub evidence is best-effort — if the
 * GitHub context cannot be resolved or the fetch fails, GitHub observations are
 * dropped and the local observations stand alone. Local keys are overlaid by
 * GitHub keys in the merged result.
 */
export const collectObservations = (
  plan: Plan,
): Effect.Effect<ProofObservations, never, Env.Env | Git.Git | NpmRegistry.NpmCli> =>
  Effect.gen(function* () {
    const localObservations = yield* collectLocalObservations(plan)
    const githubObservations = yield* Explorer.resolveGitHubContext().pipe(
      Effect.flatMap((context) =>
        collectGithubObservations(plan).pipe(
          Effect.provide(
            Github.LiveFetch({
              owner: context.target.owner,
              repo: context.target.repo,
              ...(context.token !== null ? { token: context.token } : {}),
            }),
          ),
        ),
      ),
      Effect.orElseSucceed(() => ({})),
    )
    return { ...localObservations, ...githubObservations }
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

  // A `blocked` record's `blockedBy` is its cascade root cause. If that cause is
  // itself in the set, it must be a non-passing status — a `blocked` record
  // pointing at a `proven`/`deferredToHost` cause is an internally inconsistent
  // artifact (the exact dangling-reference class the observation-layer recheck
  // makes unconstructable, but cheap to police against any future regression).
  const statusById = MutableHashMap.fromIterable(
    A.map(proof.records, (record) => [record.id, record.status] as const),
  )
  const inconsistentBlockedCauses = A.filterMap(proof.records, (record) => {
    if (record.status !== 'blocked' || record.blockedBy === undefined) return Result.failVoid
    const causeStatus = MutableHashMap.get(statusById, record.blockedBy)
    if (Option.isNone(causeStatus)) return Result.failVoid
    if (causeStatus.value !== 'proven' && causeStatus.value !== 'deferredToHost') {
      return Result.failVoid
    }
    return Result.succeed<ProofIssue>({
      recordId: record.id,
      code: 'release.proof.blocked-cause-consistency',
      detail: `Proof record ${record.id} is blocked by ${record.blockedBy}, which is ${causeStatus.value}.`,
      severity: 'hard',
    })
  })

  return [...blocking, ...missingDependencies, ...expired, ...inconsistentBlockedCauses]
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
    // oxlint-disable-next-line typescript/no-misused-spread -- field bag for .make(), which rebuilds the Schema.Class instance with overrides
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
          : [
              // oxlint-disable-next-line typescript/no-misused-spread -- field bag for .make(), which rebuilds the Schema.Class instance with overrides
              ProofTransition.make({ ...latestFresh, from: priorRecord.status }),
            ]

      return ProofRecord.make({
        // oxlint-disable-next-line typescript/no-misused-spread -- field bag for .make(), which rebuilds the Schema.Class instance with overrides
        ...freshRecord,
        proofHistory: [...priorRecord.proofHistory, ...appended],
      })
    }),
  })
}

// Read the reason of the record's *latest* transition, not its first. The
// latest transition is the one into the record's current status, so for a
// `failed` record this is the current failure reason. Reading `proofHistory[0]`
// would, on a record carried through a status flip (e.g. proven -> failed),
// reconstruct the *original* status's reason — e.g. a stale "publish identity
// observed" success string mislabeled as the failure reason — because
// `mergeProofHistory` preserves the prior's first transition.
const observedReason = (record: ProofRecord | undefined): string | undefined =>
  record?.proofHistory[record.proofHistory.length - 1]?.reason

const stringEvidence = (record: ProofRecord | undefined, key: string): string | undefined => {
  const value = record?.evidence[key]
  return typeof value === 'string' ? value : undefined
}

const booleanEvidence = (record: ProofRecord | undefined, key: string): boolean | undefined => {
  const value = record?.evidence[key]
  return typeof value === 'boolean' ? value : undefined
}

/**
 * Reconstruct the {@link ProofObservations} a prior artifact was built from, by
 * reading them back out of each record's stamped `evidence`. This is the exact
 * inverse of how {@link credentialRecordsForPlan}, {@link sideEffectProofRecordsForPlan},
 * and {@link provenanceRecordForPlan} stamp evidence, so that
 * `makeProofArtifact(plan, now, priorObservationsFromArtifact(prior))` reproduces
 * the prior's per-record statuses. {@link recheckProof} uses it to carry forward
 * the surfaces a fresh recheck did not re-observe, then overlays the fresh
 * observations on top so a single consistent `makeProofArtifact` pass rebuilds the
 * whole set.
 *
 * Fidelity contract (covered by a round-trip test): for every observation surface
 * that drives a record status, the evidence read here must produce a value that
 * re-derives the same status. `failed` credential/access records (no positive
 * observation in evidence) are reconstructed via their observed-reason error
 * string; `deferredToHost`/`unprovable` records carry no observation so the
 * rebuild re-derives those statuses from the plan intent alone.
 */
export const priorObservationsFromArtifact = (prior: ProofArtifact): ProofObservations => {
  const observations: {
    identity?: string
    identityError?: string
    packageAccess: Record<string, 'public' | 'restricted'>
    packageAccessErrors: Record<string, string>
    gitPushDryRun: Record<string, { readonly ok: boolean; readonly detail?: string }>
    atomicGitPushDryRun?: { readonly ok: boolean; readonly detail?: string }
    githubReleasePermission?: boolean
    githubReleasePermissionError?: string
    githubReleaseExists: Record<string, boolean>
    trustedPublisherConfigured?: boolean
    oidcClaimsVerified?: boolean
    provenanceBundleExists?: boolean
  } = {
    packageAccess: {},
    packageAccessErrors: {},
    gitPushDryRun: {},
    githubReleaseExists: {},
  }

  for (const record of prior.records) {
    if (record.id === 'env.publish.identity') {
      const identity = stringEvidence(record, 'identity')
      if (identity !== undefined) {
        observations.identity = identity
      } else if (record.status === 'failed') {
        observations.identityError = observedReason(record) ?? 'publish identity failed'
      }
      continue
    }

    const accessPrefix = 'env.publish.package-access.'
    if (record.id.startsWith(accessPrefix)) {
      const name = stringEvidence(record, 'packageName') ?? record.id.slice(accessPrefix.length)
      const access = record.evidence['access']
      if (access === 'public' || access === 'restricted') {
        observations.packageAccess[name] = access
      } else if (record.status === 'failed') {
        observations.packageAccessErrors[name] =
          observedReason(record) ?? 'package access does not satisfy publish intent'
      }
      continue
    }

    if (record.id === 'env.git.push-dry-run.atomic') {
      const ok = booleanEvidence(record, 'ok')
      if (ok !== undefined) {
        const detail = stringEvidence(record, 'detail')
        observations.atomicGitPushDryRun = detail === undefined ? { ok } : { ok, detail }
      }
      continue
    }

    const gitPrefix = 'env.git.push-dry-run.'
    if (record.id.startsWith(gitPrefix)) {
      const tag = stringEvidence(record, 'tag') ?? record.id.slice(gitPrefix.length)
      const ok = booleanEvidence(record, 'ok')
      if (ok !== undefined) {
        const detail = stringEvidence(record, 'detail')
        observations.gitPushDryRun[tag] = detail === undefined ? { ok } : { ok, detail }
      }
      continue
    }

    if (record.id === 'env.github.release-permission') {
      const permission = booleanEvidence(record, 'permission')
      if (permission !== undefined) {
        observations.githubReleasePermission = permission
        if (permission === false) {
          observations.githubReleasePermissionError =
            observedReason(record) ?? 'github release permission failed'
        }
      }
      continue
    }

    const releaseByTagPrefix = 'env.github.release-by-tag.'
    if (record.id.startsWith(releaseByTagPrefix)) {
      const tag = stringEvidence(record, 'tag') ?? record.id.slice(releaseByTagPrefix.length)
      const exists = booleanEvidence(record, 'exists')
      if (exists !== undefined) observations.githubReleaseExists[tag] = exists
      continue
    }

    if (record.id === 'publish.provenance-policy') {
      const trustedPublisherConfigured = booleanEvidence(record, 'trustedPublisherConfigured')
      if (trustedPublisherConfigured !== undefined) {
        observations.trustedPublisherConfigured = trustedPublisherConfigured
      }
      const oidcClaimsVerified = booleanEvidence(record, 'oidcClaimsVerified')
      if (oidcClaimsVerified !== undefined) observations.oidcClaimsVerified = oidcClaimsVerified
      const provenanceBundleExists = booleanEvidence(record, 'provenanceBundleExists')
      if (provenanceBundleExists !== undefined) {
        observations.provenanceBundleExists = provenanceBundleExists
      }
    }
  }

  return {
    ...(observations.identity !== undefined ? { identity: observations.identity } : {}),
    ...(observations.identityError !== undefined
      ? { identityError: observations.identityError }
      : {}),
    ...(Object.keys(observations.packageAccess).length > 0
      ? { packageAccess: observations.packageAccess }
      : {}),
    ...(Object.keys(observations.packageAccessErrors).length > 0
      ? { packageAccessErrors: observations.packageAccessErrors }
      : {}),
    ...(Object.keys(observations.gitPushDryRun).length > 0
      ? { gitPushDryRun: observations.gitPushDryRun }
      : {}),
    ...(observations.atomicGitPushDryRun !== undefined
      ? { atomicGitPushDryRun: observations.atomicGitPushDryRun }
      : {}),
    ...(observations.githubReleasePermission !== undefined
      ? { githubReleasePermission: observations.githubReleasePermission }
      : {}),
    ...(observations.githubReleasePermissionError !== undefined
      ? { githubReleasePermissionError: observations.githubReleasePermissionError }
      : {}),
    ...(Object.keys(observations.githubReleaseExists).length > 0
      ? { githubReleaseExists: observations.githubReleaseExists }
      : {}),
    ...(observations.trustedPublisherConfigured !== undefined
      ? { trustedPublisherConfigured: observations.trustedPublisherConfigured }
      : {}),
    ...(observations.oidcClaimsVerified !== undefined
      ? { oidcClaimsVerified: observations.oidcClaimsVerified }
      : {}),
    ...(observations.provenanceBundleExists !== undefined
      ? { provenanceBundleExists: observations.provenanceBundleExists }
      : {}),
  }
}

/**
 * Overlay freshly gathered observations onto the prior-reconstructed observations
 * so that "fresh wins" holds at the SURFACE level, not merely the field level.
 * Several surfaces carry a success/error field pair where exactly one side is
 * present at a time (identity success vs. error; per-package access vs. access
 * error; github release permission vs. its error). A naive object spread would
 * keep the prior's success field while the fresh observation only sets the error
 * field, leaving the surface stuck at its prior status. This merge re-observes a
 * surface as a unit: a fresh signal for either side of a pair drops the prior's
 * other side before applying the fresh values. Per-key surfaces (git dry-runs,
 * github release existence, per-package access) merge key-by-key so unobserved
 * keys carry forward from the prior.
 */
const mergeObservations = (
  prior: ProofObservations,
  fresh: ProofObservations,
): ProofObservations => {
  const freshObservesIdentity = fresh.identity !== undefined || fresh.identityError !== undefined
  const identitySource = freshObservesIdentity ? fresh : prior

  const freshObservesPermission =
    fresh.githubReleasePermission !== undefined || fresh.githubReleasePermissionError !== undefined
  const permissionSource = freshObservesPermission ? fresh : prior

  const accessNames = A.dedupe([
    ...Object.keys(prior.packageAccess ?? {}),
    ...Object.keys(prior.packageAccessErrors ?? {}),
    ...Object.keys(fresh.packageAccess ?? {}),
    ...Object.keys(fresh.packageAccessErrors ?? {}),
  ])
  const packageAccess: Record<string, 'public' | 'restricted'> = {}
  const packageAccessErrors: Record<string, string> = {}
  for (const name of accessNames) {
    const freshObservesName =
      fresh.packageAccess?.[name] !== undefined || fresh.packageAccessErrors?.[name] !== undefined
    const source = freshObservesName ? fresh : prior
    const access = source.packageAccess?.[name]
    const accessError = source.packageAccessErrors?.[name]
    if (access !== undefined) packageAccess[name] = access
    if (accessError !== undefined) packageAccessErrors[name] = accessError
  }

  return {
    ...(identitySource.identity !== undefined ? { identity: identitySource.identity } : {}),
    ...(identitySource.identityError !== undefined
      ? { identityError: identitySource.identityError }
      : {}),
    ...(Object.keys(packageAccess).length > 0 ? { packageAccess } : {}),
    ...(Object.keys(packageAccessErrors).length > 0 ? { packageAccessErrors } : {}),
    ...(prior.gitPushDryRun !== undefined || fresh.gitPushDryRun !== undefined
      ? { gitPushDryRun: { ...prior.gitPushDryRun, ...fresh.gitPushDryRun } }
      : {}),
    ...(fresh.atomicGitPushDryRun !== undefined
      ? { atomicGitPushDryRun: fresh.atomicGitPushDryRun }
      : prior.atomicGitPushDryRun !== undefined
        ? { atomicGitPushDryRun: prior.atomicGitPushDryRun }
        : {}),
    ...(permissionSource.githubReleasePermission !== undefined
      ? { githubReleasePermission: permissionSource.githubReleasePermission }
      : {}),
    ...(permissionSource.githubReleasePermissionError !== undefined
      ? { githubReleasePermissionError: permissionSource.githubReleasePermissionError }
      : {}),
    ...(prior.githubReleaseExists !== undefined || fresh.githubReleaseExists !== undefined
      ? { githubReleaseExists: { ...prior.githubReleaseExists, ...fresh.githubReleaseExists } }
      : {}),
    ...(fresh.trustedPublisherConfigured !== undefined
      ? { trustedPublisherConfigured: fresh.trustedPublisherConfigured }
      : prior.trustedPublisherConfigured !== undefined
        ? { trustedPublisherConfigured: prior.trustedPublisherConfigured }
        : {}),
    ...(fresh.oidcClaimsVerified !== undefined
      ? { oidcClaimsVerified: fresh.oidcClaimsVerified }
      : prior.oidcClaimsVerified !== undefined
        ? { oidcClaimsVerified: prior.oidcClaimsVerified }
        : {}),
    ...(fresh.provenanceBundleExists !== undefined
      ? { provenanceBundleExists: fresh.provenanceBundleExists }
      : prior.provenanceBundleExists !== undefined
        ? { provenanceBundleExists: prior.provenanceBundleExists }
        : {}),
  }
}

/**
 * Re-derive a proof artifact against fresh observations and merge it onto the
 * prior. The splice is at the OBSERVATION layer, not the record layer: the
 * caller hands in whatever observations it freshly gathered (the pre-mutation
 * hook gathers local surfaces; apply gathers local + GitHub), those are overlaid
 * on the observations reconstructed from the prior artifact's evidence (fresh
 * wins per surface — see {@link mergeObservations}), and a single pure
 * {@link makeProofArtifact} pass rebuilds and cascades the whole set. The result
 * is internally consistent by construction — every `blocked` record points at a
 * cause that is genuinely non-`proven` in the same artifact, because every record
 * was derived from one observation epoch. History grows per record via
 * {@link mergeProofHistory} (a status flip is recorded, an unchanged status
 * appends nothing). This is the proof-blind recheck primitive the apply boundary
 * and any executor mutation hook drive.
 */
export const recheckProof = (params: {
  readonly plan: Plan
  readonly prior: ProofArtifact
  readonly observations: ProofObservations
  readonly now: string
}): ProofArtifact => {
  const merged = mergeObservations(priorObservationsFromArtifact(params.prior), params.observations)
  const fresh = makeProofArtifact(params.plan, params.now, merged)
  return mergeProofHistory(params.prior, fresh)
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

/**
 * Internal surface exposed only for tests. `cascadeBlocked` carries a fail-loud
 * topological invariant (see its doc comment) that no production caller can trip
 * — `makeProofArtifact` always emits records in dependency-before-dependent order
 * — so the guard's negative path is otherwise unreachable from any public entry.
 * This namespace lets the test pin that guard directly without widening the
 * public API.
 */
export const _ = {
  cascadeBlocked,
} as const
