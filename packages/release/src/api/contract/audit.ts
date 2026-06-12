/**
 * @module api/contract/audit
 *
 * Audit-archive manifest contract: the signed index of the evidence bundle.
 */
import { Fs } from '@kitz/fs'
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { DetachedSignature } from './trust.js'

export class AuditArchiveManifest extends Sch.Class<AuditArchiveManifest>()(
  'AuditArchiveManifest',
  {
    schemaVersion: Schema.Literal(1),
    planDigest: Digest,
    createdAt: Schema.DateTimeUtcFromString,
    files: Schema.Array(
      Schema.Struct({
        path: Fs.Path.RelFile.Schema,
        sha256: Digest,
      }),
    ),
    signature: DetachedSignature,
  },
) {}
