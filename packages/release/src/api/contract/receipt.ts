/**
 * @module api/contract/receipt
 *
 * Registry observation and publish receipt contracts: what the registry was
 * observed to hold, and the byte-verified proof a publish landed.
 */
import { Pkg } from '@kitz/pkg'
import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest } from '../digest.js'

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown)

export class RegistryObservation extends Sch.Class<RegistryObservation>()('RegistryObservation', {
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  registry: Schema.String,
  observedAt: Schema.DateTimeUtcFromString,
  versionMetadata: JsonRecord,
  distTags: Schema.Record(Schema.String, Schema.String),
  accessStatus: Schema.optional(Schema.Literals(['public', 'private', 'restricted', 'unknown'])),
  tarballUrl: Schema.optional(Schema.String),
  shasum: Schema.optional(Schema.String),
  integrity: Schema.optional(Schema.String),
  downloadedTarballSha256: Schema.optional(Digest),
}) {}

export class PublishReceipt extends Sch.Class<PublishReceipt>()('PublishReceipt', {
  schemaVersion: Schema.Literal(1),
  planDigest: Digest,
  tarballSha256: Digest,
  observation: RegistryObservation,
  verifiedAt: Schema.DateTimeUtcFromString,
}) {}
