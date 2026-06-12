/**
 * @module api/contract/lock
 *
 * Execution-lock contract. Timestamps decode to `DateTime.Utc`, so a corrupt
 * persisted `expiresAt` fails decode instead of producing a lock that never
 * expires (`Date.parse(corrupt)` is `NaN` and `NaN <= x` is always false).
 */
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { PrincipalRef } from './trust.js'

export class ExecutionLock extends Sch.Class<ExecutionLock>()('ExecutionLock', {
  schemaVersion: Schema.Literal(1),
  planDigest: Digest,
  owner: PrincipalRef,
  ownerHost: Schema.String,
  ownerProcess: Schema.String,
  acquiredAt: Schema.DateTimeUtcFromString,
  heartbeatAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
  backend: Schema.Literals(['local-file', 'remote-git-ref']),
  remoteRef: Schema.optional(Schema.String),
  recoveryRequiresSignature: Schema.Boolean,
}) {}
