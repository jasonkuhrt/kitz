/**
 * @module api/contract/proof
 *
 * Proof contracts: machine-checkable environment evidence collected before
 * mutations. Timestamps decode to `DateTime.Utc`, so malformed persisted
 * values fail decode instead of silently disabling staleness checks.
 */
import { Fs } from '@kitz/fs'
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { RuntimeHost } from './trust.js'

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown)

export const ProofStatus = Schema.Literals([
  'proven',
  'failed',
  'unprovable',
  'deferredToHost',
  'blocked',
])
export type ProofStatus = typeof ProofStatus.Type

export const ProofRecheckMode = Schema.Literals([
  'pre-apply',
  'pre-each-mutation',
  'pre-apply-and-on-mutation-failure',
])
export type ProofRecheckMode = typeof ProofRecheckMode.Type

export class ProofPolicy extends Sch.Class<ProofPolicy>()('ProofPolicy', {
  requiredStatuses: Schema.Array(ProofStatus),
  authProofTtlSeconds: Schema.Number,
  registryProofTtlSeconds: Schema.Number,
  maxClockSkewSeconds: Schema.Number,
  defaultRecheckMode: ProofRecheckMode,
  hostDeferral: Schema.Struct({
    allowed: Schema.Boolean,
    runtimeHosts: Schema.Array(RuntimeHost),
  }),
  byteVerifyRegistryTarball: Schema.Literals(['always', 'official-only', 'never']),
}) {}

export class ProofTransition extends Sch.Class<ProofTransition>()('ProofTransition', {
  from: Schema.optional(ProofStatus),
  to: ProofStatus,
  at: Schema.DateTimeUtcFromString,
  reason: Schema.String,
}) {}

export class ProofRecord extends Sch.Class<ProofRecord>()('ProofRecord', {
  id: Schema.String,
  status: ProofStatus,
  dependsOn: Schema.Array(Schema.String),
  recheckMode: ProofRecheckMode,
  observedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.optional(Schema.DateTimeUtcFromString),
  evidence: JsonRecord,
  proofHistory: Schema.Array(ProofTransition),
}) {}

export class ProofArtifact extends Sch.Class<ProofArtifact>()('ProofArtifact', {
  schemaVersion: Schema.Literal(1),
  planDigest: Digest,
  records: Schema.Array(ProofRecord),
}) {}

export class WorkflowCallProofLink extends Sch.Class<WorkflowCallProofLink>()(
  'WorkflowCallProofLink',
  {
    workflowFile: Fs.Path.RelFile.Schema,
    jobId: Schema.String,
    caller: Schema.optional(Schema.String),
    effectivePermissions: Schema.Record(Schema.String, Schema.String),
    passesIdTokenWrite: Schema.Boolean,
    passesContentsWrite: Schema.Boolean,
  },
) {}

export const defaultProofPolicy = (runtimeHost: RuntimeHost = 'local-interactive'): ProofPolicy =>
  ProofPolicy.make({
    requiredStatuses: ['proven'],
    authProofTtlSeconds: runtimeHost === 'local-interactive' ? 86_400 : 3_600,
    registryProofTtlSeconds: runtimeHost === 'local-interactive' ? 3_600 : 1_800,
    maxClockSkewSeconds: 300,
    defaultRecheckMode: 'pre-apply',
    hostDeferral: { allowed: false, runtimeHosts: [] },
    byteVerifyRegistryTarball: 'always',
  })
