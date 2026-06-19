import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { PublishCapability } from './models/capability.js'

export class SubcommandProofRequest extends Schema.Class<SubcommandProofRequest>(
  'SubcommandProofRequest',
)({
  binary: Schema.String,
  subcommands: Schema.Array(Schema.String),
}) {
  static is = Schema.is(SubcommandProofRequest)
  static decode = Schema.decodeUnknownEffect(SubcommandProofRequest)
  static decodeSync = Schema.decodeUnknownSync(SubcommandProofRequest)
  static encode = Schema.encodeUnknownEffect(SubcommandProofRequest)
  static encodeSync = Schema.encodeUnknownSync(SubcommandProofRequest)
  static equivalence = Schema.toEquivalence(SubcommandProofRequest)
  static ordered = false as const
}

export class PackRequest extends Schema.Class<PackRequest>('PackRequest')({
  packageDir: Fs.Path.AbsDir.Schema,
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  destination: Fs.Path.AbsDir.Schema,
}) {
  static is = Schema.is(PackRequest)
  static decode = Schema.decodeUnknownEffect(PackRequest)
  static decodeSync = Schema.decodeUnknownSync(PackRequest)
  static encode = Schema.encodeUnknownEffect(PackRequest)
  static encodeSync = Schema.encodeUnknownSync(PackRequest)
  static equivalence = Schema.toEquivalence(PackRequest)
  static ordered = false as const
}

export const PublishAccess = Schema.Literals(['public', 'restricted'])
export type PublishAccess = typeof PublishAccess.Type

export class PublishRequest extends Schema.Class<PublishRequest>('PublishRequest')({
  tarball: Fs.Path.AbsFile.Schema,
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  distTag: Schema.String,
  registry: Schema.optional(Schema.String),
  access: Schema.optional(PublishAccess),
  otp: Schema.optional(Schema.String),
  provenance: Schema.optional(Schema.Boolean),
  capabilities: Schema.Array(PublishCapability),
}) {
  static is = Schema.is(PublishRequest)
  static decode = Schema.decodeUnknownEffect(PublishRequest)
  static decodeSync = Schema.decodeUnknownSync(PublishRequest)
  static encode = Schema.encodeUnknownEffect(PublishRequest)
  static encodeSync = Schema.encodeUnknownSync(PublishRequest)
  static equivalence = Schema.toEquivalence(PublishRequest)
  static ordered = false as const
}

export class VersionQuery extends Schema.Class<VersionQuery>('VersionQuery')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(VersionQuery)
  static decode = Schema.decodeUnknownEffect(VersionQuery)
  static decodeSync = Schema.decodeUnknownSync(VersionQuery)
  static encode = Schema.encodeUnknownEffect(VersionQuery)
  static encodeSync = Schema.encodeUnknownSync(VersionQuery)
  static equivalence = Schema.toEquivalence(VersionQuery)
  static ordered = false as const
}

export class BatchVersionQuery extends Schema.Class<BatchVersionQuery>('BatchVersionQuery')({
  versions: Schema.Array(VersionQuery),
}) {
  static is = Schema.is(BatchVersionQuery)
  static decode = Schema.decodeUnknownEffect(BatchVersionQuery)
  static decodeSync = Schema.decodeUnknownSync(BatchVersionQuery)
  static encode = Schema.encodeUnknownEffect(BatchVersionQuery)
  static encodeSync = Schema.encodeUnknownSync(BatchVersionQuery)
  static equivalence = Schema.toEquivalence(BatchVersionQuery)
  static ordered = false as const
}

export class DistTagQuery extends Schema.Class<DistTagQuery>('DistTagQuery')({
  packageName: Pkg.Moniker.FromString,
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(DistTagQuery)
  static decode = Schema.decodeUnknownEffect(DistTagQuery)
  static decodeSync = Schema.decodeUnknownSync(DistTagQuery)
  static encode = Schema.encodeUnknownEffect(DistTagQuery)
  static encodeSync = Schema.encodeUnknownSync(DistTagQuery)
  static equivalence = Schema.toEquivalence(DistTagQuery)
  static ordered = false as const
}

export class BatchDistTagQuery extends Schema.Class<BatchDistTagQuery>('BatchDistTagQuery')({
  packages: Schema.Array(DistTagQuery),
}) {
  static is = Schema.is(BatchDistTagQuery)
  static decode = Schema.decodeUnknownEffect(BatchDistTagQuery)
  static decodeSync = Schema.decodeUnknownSync(BatchDistTagQuery)
  static encode = Schema.encodeUnknownEffect(BatchDistTagQuery)
  static encodeSync = Schema.encodeUnknownSync(BatchDistTagQuery)
  static equivalence = Schema.toEquivalence(BatchDistTagQuery)
  static ordered = false as const
}

export class AccessQuery extends Schema.Class<AccessQuery>('AccessQuery')({
  packageName: Pkg.Moniker.FromString,
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(AccessQuery)
  static decode = Schema.decodeUnknownEffect(AccessQuery)
  static decodeSync = Schema.decodeUnknownSync(AccessQuery)
  static encode = Schema.encodeUnknownEffect(AccessQuery)
  static encodeSync = Schema.encodeUnknownSync(AccessQuery)
  static equivalence = Schema.toEquivalence(AccessQuery)
  static ordered = false as const
}

export class BatchAccessQuery extends Schema.Class<BatchAccessQuery>('BatchAccessQuery')({
  packages: Schema.Array(AccessQuery),
}) {
  static is = Schema.is(BatchAccessQuery)
  static decode = Schema.decodeUnknownEffect(BatchAccessQuery)
  static decodeSync = Schema.decodeUnknownSync(BatchAccessQuery)
  static encode = Schema.encodeUnknownEffect(BatchAccessQuery)
  static encodeSync = Schema.encodeUnknownSync(BatchAccessQuery)
  static equivalence = Schema.toEquivalence(BatchAccessQuery)
  static ordered = false as const
}

export class WhoamiRequest extends Schema.Class<WhoamiRequest>('WhoamiRequest')({
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(WhoamiRequest)
  static decode = Schema.decodeUnknownEffect(WhoamiRequest)
  static decodeSync = Schema.decodeUnknownSync(WhoamiRequest)
  static encode = Schema.encodeUnknownEffect(WhoamiRequest)
  static encodeSync = Schema.encodeUnknownSync(WhoamiRequest)
  static equivalence = Schema.toEquivalence(WhoamiRequest)
  static ordered = false as const
}

export class OtpRequest extends Schema.Class<OtpRequest>('OtpRequest')({
  prompt: Schema.String,
}) {
  static is = Schema.is(OtpRequest)
  static decode = Schema.decodeUnknownEffect(OtpRequest)
  static decodeSync = Schema.decodeUnknownSync(OtpRequest)
  static encode = Schema.encodeUnknownEffect(OtpRequest)
  static encodeSync = Schema.encodeUnknownSync(OtpRequest)
  static equivalence = Schema.toEquivalence(OtpRequest)
  static ordered = false as const
}

export class TrustedPublisherQuery extends Schema.Class<TrustedPublisherQuery>(
  'TrustedPublisherQuery',
)({
  packageName: Pkg.Moniker.FromString,
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(TrustedPublisherQuery)
  static decode = Schema.decodeUnknownEffect(TrustedPublisherQuery)
  static decodeSync = Schema.decodeUnknownSync(TrustedPublisherQuery)
  static encode = Schema.encodeUnknownEffect(TrustedPublisherQuery)
  static encodeSync = Schema.encodeUnknownSync(TrustedPublisherQuery)
  static equivalence = Schema.toEquivalence(TrustedPublisherQuery)
  static ordered = false as const
}

export const TrustedPublisherProvider = Schema.Literals(['github', 'gitlab', 'circleci'])
export type TrustedPublisherProvider = typeof TrustedPublisherProvider.Type

export class TrustedPublisherSetup extends Schema.Class<TrustedPublisherSetup>(
  'TrustedPublisherSetup',
)({
  packageName: Pkg.Moniker.FromString,
  provider: TrustedPublisherProvider,
  repository: Schema.String,
  workflow: Schema.String,
  registry: Schema.optional(Schema.String),
}) {
  static is = Schema.is(TrustedPublisherSetup)
  static decode = Schema.decodeUnknownEffect(TrustedPublisherSetup)
  static decodeSync = Schema.decodeUnknownSync(TrustedPublisherSetup)
  static encode = Schema.encodeUnknownEffect(TrustedPublisherSetup)
  static encodeSync = Schema.encodeUnknownSync(TrustedPublisherSetup)
  static equivalence = Schema.toEquivalence(TrustedPublisherSetup)
  static ordered = false as const
}

export class ArtifactBuildRequest extends Schema.Class<ArtifactBuildRequest>(
  'ArtifactBuildRequest',
)({
  packageDir: Fs.Path.AbsDir.Schema,
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  destination: Fs.Path.AbsDir.Schema,
  manifestTransform: Schema.Record(Schema.String, Schema.Unknown),
}) {
  static is = Schema.is(ArtifactBuildRequest)
  static decode = Schema.decodeUnknownEffect(ArtifactBuildRequest)
  static decodeSync = Schema.decodeUnknownSync(ArtifactBuildRequest)
  static encode = Schema.encodeUnknownEffect(ArtifactBuildRequest)
  static encodeSync = Schema.encodeUnknownSync(ArtifactBuildRequest)
  static equivalence = Schema.toEquivalence(ArtifactBuildRequest)
  static ordered = false as const
}
