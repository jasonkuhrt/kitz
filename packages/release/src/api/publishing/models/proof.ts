import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest } from '../../digest.js'
import { PublishCapability } from './capability.js'
import { PublishDriverId } from './driver-id.js'

export class DriverVersionProof extends Schema.Class<DriverVersionProof>('DriverVersionProof')({
  driver: PublishDriverId,
  binary: Schema.String,
  version: Schema.String,
  observedAt: Schema.String,
}) {
  static is = Schema.is(DriverVersionProof)
  static decode = Schema.decodeUnknownEffect(DriverVersionProof)
  static decodeSync = Schema.decodeUnknownSync(DriverVersionProof)
  static encode = Schema.encodeUnknownEffect(DriverVersionProof)
  static encodeSync = Schema.encodeUnknownSync(DriverVersionProof)
  static equivalence = Schema.toEquivalence(DriverVersionProof)
  static ordered = false as const
  static make = this.makeUnsafe
}

export class SubcommandProof extends Schema.Class<SubcommandProof>('SubcommandProof')({
  driver: PublishDriverId,
  binary: Schema.String,
  subcommands: Schema.Record(Schema.String, Schema.Boolean),
  observedAt: Schema.String,
}) {
  static is = Schema.is(SubcommandProof)
  static decode = Schema.decodeUnknownEffect(SubcommandProof)
  static decodeSync = Schema.decodeUnknownSync(SubcommandProof)
  static encode = Schema.encodeUnknownEffect(SubcommandProof)
  static encodeSync = Schema.encodeUnknownSync(SubcommandProof)
  static equivalence = Schema.toEquivalence(SubcommandProof)
  static ordered = false as const
  static make = this.makeUnsafe
}

export class PackedArtifact extends Schema.Class<PackedArtifact>('PackedArtifact')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  tarball: Fs.Path.AbsFile.Schema,
  sha256: Digest,
  sizeBytes: Schema.Number,
  packlist: Schema.Array(Fs.Path.RelFile.Schema),
}) {
  static is = Schema.is(PackedArtifact)
  static decode = Schema.decodeUnknownEffect(PackedArtifact)
  static decodeSync = Schema.decodeUnknownSync(PackedArtifact)
  static encode = Schema.encodeUnknownEffect(PackedArtifact)
  static encodeSync = Schema.encodeUnknownSync(PackedArtifact)
  static equivalence = Schema.toEquivalence(PackedArtifact)
  static ordered = false as const
  static make = this.makeUnsafe
}

export class PublishDryRunProof extends Schema.Class<PublishDryRunProof>('PublishDryRunProof')({
  driver: PublishDriverId,
  command: Schema.Array(Schema.String),
  capabilities: Schema.Array(PublishCapability),
  observedAt: Schema.String,
}) {
  static is = Schema.is(PublishDryRunProof)
  static decode = Schema.decodeUnknownEffect(PublishDryRunProof)
  static decodeSync = Schema.decodeUnknownSync(PublishDryRunProof)
  static encode = Schema.encodeUnknownEffect(PublishDryRunProof)
  static encodeSync = Schema.encodeUnknownSync(PublishDryRunProof)
  static equivalence = Schema.toEquivalence(PublishDryRunProof)
  static ordered = false as const
  static make = this.makeUnsafe
}

export class PublishReceipt extends Schema.Class<PublishReceipt>('PublishReceipt')({
  driver: PublishDriverId,
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  distTag: Schema.String,
  registry: Schema.String,
  command: Schema.Array(Schema.String),
  observedAt: Schema.String,
}) {
  static is = Schema.is(PublishReceipt)
  static decode = Schema.decodeUnknownEffect(PublishReceipt)
  static decodeSync = Schema.decodeUnknownSync(PublishReceipt)
  static encode = Schema.encodeUnknownEffect(PublishReceipt)
  static encodeSync = Schema.encodeUnknownSync(PublishReceipt)
  static equivalence = Schema.toEquivalence(PublishReceipt)
  static ordered = false as const
  static make = this.makeUnsafe
}
