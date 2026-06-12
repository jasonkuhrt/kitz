/**
 * @module api/contract/artifact
 *
 * Artifact-manifest contract: the rehearsed tarball metadata bound to a plan
 * digest.
 */
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest } from '../digest.js'

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown)

export class ArtifactManifest extends Sch.Class<ArtifactManifest>()('ArtifactManifest', {
  schemaVersion: Schema.Literal(1),
  planDigest: Digest,
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  driver: Schema.String,
  tarball: Fs.Path.AbsFile.Schema,
  sha256: Digest,
  sizeBytes: Schema.Number,
  manifest: JsonRecord,
  packlist: Schema.Array(Fs.Path.RelFile.Schema),
  rewrittenFields: Schema.Array(Schema.String),
  npmRegistryIntegrity: Schema.optional(Schema.String),
  npmRegistryShasum: Schema.optional(Schema.String),
}) {}
