import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Option, Schema } from 'effect'
import { sha256Json } from './digest.js'
import type { Plan } from './planner/models/plan.js'
import {
  capabilityResultForProvider,
  type CapabilityProviderId,
  type PublishCapability,
} from './publishing/models/capability.js'
import {
  PlanDigest,
  ProofArtifact,
  ProofRecord,
  ProofTransition,
  type ProofStatus,
} from './release-contract.js'

const proofDir = Fs.Path.RelDir.fromString('./.release/proofs/')

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

const capabilityRecord = (params: {
  readonly id: string
  readonly provider: CapabilityProviderId
  readonly capability: PublishCapability
  readonly now: string
}): ProofRecord => {
  const result = capabilityResultForProvider({
    capability: params.capability,
    provider: params.provider,
  })
  const status: ProofStatus = result._tag === 'Supported' ? 'proven' : 'blocked'
  const reason =
    result._tag === 'Supported'
      ? 'provider capability supported'
      : `provider capability unsupported: ${result.reason}`

  return ProofRecord.make({
    id: params.id,
    status,
    dependsOn: ['plan.publish-intent'],
    recheckMode: 'pre-apply',
    observedAt: params.now,
    evidence: result,
    proofHistory: [transition(status, reason, params.now)],
  })
}

const capabilityRecordsForPlan = (plan: Plan, now: string): ProofRecord[] => {
  if (plan.publishIntent === undefined) return []

  const packDriver = plan.publishIntent.profile.packDriver
  const publishInvoker = plan.publishIntent.profile.publishInvoker
  const publishCapabilities: PublishCapability[] = [
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
    ...publishCapabilities.map((capability) =>
      capabilityRecord({
        id: `capability.${capability.replace(':', '.')}`,
        provider: publishInvoker,
        capability,
        now,
      }),
    ),
  ]
}

export const makeProofArtifact = (
  plan: Plan,
  now: string = new Date().toISOString(),
): ProofArtifact => {
  const records = [
    ProofRecord.make({
      id: 'plan.digest',
      status: plan.planDigest === undefined ? 'unprovable' : 'proven',
      dependsOn: [],
      recheckMode: 'pre-apply',
      observedAt: now,
      evidence:
        plan.planDigest === undefined
          ? { reason: 'plan has no frozen digest' }
          : { digest: plan.planDigest.value },
      proofHistory: [
        transition(
          plan.planDigest === undefined ? 'unprovable' : 'proven',
          'plan digest checked',
          now,
        ),
      ],
    }),
    ProofRecord.make({
      id: 'plan.publish-intent',
      status: plan.publishIntent === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      recheckMode: 'pre-apply',
      observedAt: now,
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
          now,
        ),
      ],
    }),
    ProofRecord.make({
      id: 'plan.source',
      status: plan.source === undefined ? 'unprovable' : 'proven',
      dependsOn: ['plan.digest'],
      recheckMode: 'pre-apply',
      observedAt: now,
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
          now,
        ),
      ],
    }),
    ...capabilityRecordsForPlan(plan, now),
  ]

  return ProofArtifact.make({
    schemaVersion: 1,
    planDigest: digestForPlan(plan),
    records,
  })
}

export const hasBlockingProof = (proof: ProofArtifact): boolean =>
  proof.records.some((record) => record.status !== 'proven' && record.status !== 'deferredToHost')

export const write = (
  proof: ProofArtifact,
  path: Fs.Path.AbsFile,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
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
  PlatformError | Schema.SchemaError,
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

export const prove = (
  plan: Plan,
): Effect.Effect<ProofArtifact, PlatformError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const proof = makeProofArtifact(plan)
    yield* write(proof, proofPathFor(env.cwd, plan))
    return proof
  })

export const readForPlan = (
  plan: Plan,
): Effect.Effect<
  Option.Option<ProofArtifact>,
  PlatformError | Schema.SchemaError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    return yield* read(proofPathFor(env.cwd, plan))
  })
