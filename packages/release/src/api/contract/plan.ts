/**
 * @module api/contract/plan
 *
 * Plan body, source snapshot, and signed envelope contracts.
 */
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest, sha256Json } from '../digest.js'
import { defaultProofPolicy, ProofPolicy } from './proof.js'
import { PublishIntent } from './publish-intent.js'
import { DetachedSignature } from './trust.js'

export class PlanSourceSnapshot extends Sch.Class<PlanSourceSnapshot>()('PlanSourceSnapshot', {
  headSha: Schema.String,
  trunk: Schema.String,
  releaseConfigDigest: Digest,
  releaseConfigDigestSource: Schema.Literal('canonical-effective-config'),
  lockfiles: Schema.Array(
    Schema.Struct({
      path: Fs.Path.RelFile.Schema,
      digest: Digest,
    }),
  ),
  packageManager: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    binary: Schema.String,
    subcommands: Schema.Record(Schema.String, Schema.Boolean),
  }),
  toolVersions: Schema.Record(Schema.String, Schema.String),
}) {}

export class PlanBody extends Sch.Class<PlanBody>()('PlanBody', {
  schemaVersion: Schema.Literal(2),
  signingProfileId: Schema.String,
  source: PlanSourceSnapshot,
  publishIntent: PublishIntent,
  proofPolicy: ProofPolicy,
  releases: Schema.Array(
    Schema.Struct({
      packageName: Pkg.Moniker.FromString,
      nextVersion: Semver.Schema,
    }),
  ),
}) {}

export class PlanEnvelope extends Sch.Class<PlanEnvelope>()('PlanEnvelope', {
  schemaVersion: Schema.Literal(1),
  digest: Digest,
  body: PlanBody,
  signature: DetachedSignature,
}) {}

export const digestPlanBody = (body: PlanBody): Digest =>
  sha256Json(Schema.encodeSync(PlanBody)(body))

export const makeUnsignedEnvelope = (body: PlanBody): PlanEnvelope =>
  PlanEnvelope.make({
    schemaVersion: 1,
    digest: digestPlanBody(body),
    body,
    signature: DetachedSignature.make({
      algorithm: 'ssh-signature',
      signer: 'unsigned-local-plan',
      signature: 'unsigned',
    }),
  })
