/**
 * @module api/contract/journal
 *
 * Execution-journal contracts: the hash-chained ledger of attempted side
 * effects and observed failures.
 */
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { PrincipalRef } from './trust.js'

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown)

export const SideEffectKind = Schema.Literals([
  'registry-publish',
  'registry-dist-tag',
  'git-tag-create',
  'git-tag-push',
  'github-release-create',
  'github-release-update',
])
export type SideEffectKind = typeof SideEffectKind.Type

export class SideEffectEntry extends Sch.Class<SideEffectEntry>()('SideEffectEntry', {
  entryId: Schema.String,
  prevEntrySha256: Schema.optional(Digest),
  entrySha256: Digest,
  planDigest: Digest,
  kind: SideEffectKind,
  subject: Schema.String,
  idempotencyKey: Schema.String,
  planned: JsonRecord,
  attemptedAt: Schema.DateTimeUtcFromString,
  result: Schema.Literals(['attempting', 'succeeded', 'failed']),
}) {}

export class FailureObservation extends Sch.Class<FailureObservation>()('FailureObservation', {
  at: Schema.DateTimeUtcFromString,
  provider: Schema.String,
  category: Schema.Literals([
    'auth',
    'permission',
    'not-found',
    'conflict',
    'rate-limit',
    'network',
    'provider-5xx',
    'unknown',
  ]),
  statusCode: Schema.optional(Schema.Number),
  bodyExcerpt: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

export class ExecutionPrincipals extends Sch.Class<ExecutionPrincipals>()('ExecutionPrincipals', {
  invoker: PrincipalRef,
  planSigner: PrincipalRef,
  publisher: Schema.optional(PrincipalRef),
  runtimeHost: Schema.optional(PrincipalRef),
  gitHubActor: Schema.optional(PrincipalRef),
  lockOwner: PrincipalRef,
}) {}

export class ExecutionJournal extends Sch.Class<ExecutionJournal>()('ExecutionJournal', {
  schemaVersion: Schema.Literal(1),
  planDigest: Digest,
  workflowExecutionId: Schema.String,
  principals: ExecutionPrincipals,
  sideEffects: Schema.Array(SideEffectEntry),
  observations: Schema.Array(JsonRecord),
  failures: Schema.Array(FailureObservation),
}) {}
