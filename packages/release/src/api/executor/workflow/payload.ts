import { Git } from '@kitz/git'
import { Schema } from 'effect'
import { Publishing } from '../../publishing.js'
import { PublishDriverId } from '../../publishing/models/driver-id.js'
import { LifecycleSchema } from '../../version/models/lifecycle.js'

export const CommitEntrySchema = Schema.Struct({
  type: Schema.String,
  message: Schema.String,
  hash: Git.Sha.Sha,
  breaking: Schema.Boolean,
})

export const ReleaseSchema = Schema.Struct({
  packageName: Schema.String,
  packagePath: Schema.String,
  currentVersion: Schema.OptionFromNullOr(Schema.String),
  nextVersion: Schema.String,
  bump: Schema.UndefinedOr(Schema.Literals(['major', 'minor', 'patch'])),
  commits: Schema.Array(CommitEntrySchema),
  dependsOn: Schema.Array(Schema.String),
})

export const ReleasePayload = Schema.Struct({
  releases: Schema.Array(ReleaseSchema),
  options: Schema.Struct({
    dryRun: Schema.Boolean,
    tag: Schema.optional(Schema.String),
    registry: Schema.optional(Schema.String),
    planDigest: Schema.optional(Schema.String),
    rehearsedArtifacts: Schema.Boolean,
    atomicTagPush: Schema.Boolean,
    lifecycle: Schema.optional(LifecycleSchema),
    publishing: Schema.optional(Publishing),
    trunk: Schema.optional(Schema.String),
    packDriver: PublishDriverId,
    publishInvoker: PublishDriverId,
  }),
})

export type ReleasePayloadType = typeof ReleasePayload.Type
