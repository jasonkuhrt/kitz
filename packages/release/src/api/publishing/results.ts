import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { PublishAccess } from './requests.js'

export class VersionProof extends Schema.Class<VersionProof>('VersionProof')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  exists: Schema.Boolean,
  observedAt: Schema.String,
}) {
  static is = Schema.is(VersionProof)
  static decode = Schema.decodeUnknownEffect(VersionProof)
  static decodeSync = Schema.decodeUnknownSync(VersionProof)
  static encode = Schema.encodeUnknownEffect(VersionProof)
  static encodeSync = Schema.encodeUnknownSync(VersionProof)
  static equivalence = Schema.toEquivalence(VersionProof)
  static ordered = false as const
}

export class DistTagProof extends Schema.Class<DistTagProof>('DistTagProof')({
  packageName: Pkg.Moniker.FromString,
  distTags: Schema.Record(Schema.String, Schema.String),
  observedAt: Schema.String,
}) {
  static is = Schema.is(DistTagProof)
  static decode = Schema.decodeUnknownEffect(DistTagProof)
  static decodeSync = Schema.decodeUnknownSync(DistTagProof)
  static encode = Schema.encodeUnknownEffect(DistTagProof)
  static encodeSync = Schema.encodeUnknownSync(DistTagProof)
  static equivalence = Schema.toEquivalence(DistTagProof)
  static ordered = false as const
}

export class AccessProof extends Schema.Class<AccessProof>('AccessProof')({
  packageName: Pkg.Moniker.FromString,
  access: Schema.Option(PublishAccess),
  observedAt: Schema.String,
}) {
  static is = Schema.is(AccessProof)
  static decode = Schema.decodeUnknownEffect(AccessProof)
  static decodeSync = Schema.decodeUnknownSync(AccessProof)
  static encode = Schema.encodeUnknownEffect(AccessProof)
  static encodeSync = Schema.encodeUnknownSync(AccessProof)
  static equivalence = Schema.toEquivalence(AccessProof)
  static ordered = false as const
}

export class AuthIdentityProof extends Schema.Class<AuthIdentityProof>('AuthIdentityProof')({
  provider: Schema.String,
  username: Schema.String,
  observedAt: Schema.String,
}) {
  static is = Schema.is(AuthIdentityProof)
  static decode = Schema.decodeUnknownEffect(AuthIdentityProof)
  static decodeSync = Schema.decodeUnknownSync(AuthIdentityProof)
  static encode = Schema.encodeUnknownEffect(AuthIdentityProof)
  static encodeSync = Schema.encodeUnknownSync(AuthIdentityProof)
  static equivalence = Schema.toEquivalence(AuthIdentityProof)
  static ordered = false as const
}

export class OtpSecret extends Schema.Class<OtpSecret>('OtpSecret')({
  value: Schema.String,
}) {
  static is = Schema.is(OtpSecret)
  static decode = Schema.decodeUnknownEffect(OtpSecret)
  static decodeSync = Schema.decodeUnknownSync(OtpSecret)
  static encode = Schema.encodeUnknownEffect(OtpSecret)
  static encodeSync = Schema.encodeUnknownSync(OtpSecret)
  static equivalence = Schema.toEquivalence(OtpSecret)
  static ordered = false as const
}

export class TrustedPublisherProof extends Schema.Class<TrustedPublisherProof>(
  'TrustedPublisherProof',
)({
  packageName: Pkg.Moniker.FromString,
  provider: Schema.String,
  repository: Schema.String,
  workflow: Schema.String,
  observedAt: Schema.String,
}) {
  static is = Schema.is(TrustedPublisherProof)
  static decode = Schema.decodeUnknownEffect(TrustedPublisherProof)
  static decodeSync = Schema.decodeUnknownSync(TrustedPublisherProof)
  static encode = Schema.encodeUnknownEffect(TrustedPublisherProof)
  static encodeSync = Schema.encodeUnknownSync(TrustedPublisherProof)
  static equivalence = Schema.toEquivalence(TrustedPublisherProof)
  static ordered = false as const
}

export class RegistryTarballObservation extends Schema.Class<RegistryTarballObservation>(
  'RegistryTarballObservation',
)({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  integrity: Schema.optional(Schema.String),
  shasum: Schema.optional(Schema.String),
  sha256: Schema.optional(Digest),
  observedAt: Schema.String,
}) {
  static is = Schema.is(RegistryTarballObservation)
  static decode = Schema.decodeUnknownEffect(RegistryTarballObservation)
  static decodeSync = Schema.decodeUnknownSync(RegistryTarballObservation)
  static encode = Schema.encodeUnknownEffect(RegistryTarballObservation)
  static encodeSync = Schema.encodeUnknownSync(RegistryTarballObservation)
  static equivalence = Schema.toEquivalence(RegistryTarballObservation)
  static ordered = false as const
}
