import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { Digest, sha256Json } from './digest.js'
import { PublishDriverId } from './publishing/models/driver-id.js'
import { type PublishSemantics, PublishChannel } from './publishing.js'
import { LifecycleSchema } from './version/models/lifecycle.js'

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown)

export const RuntimeHost = Schema.Literals([
  'local-interactive',
  'local-unattended',
  'github-actions',
  'gitlab-ci',
  'circleci',
])
export type RuntimeHost = typeof RuntimeHost.Type

export class PrincipalRef extends Schema.Class<PrincipalRef>('PrincipalRef')({
  kind: Schema.Literals([
    'human',
    'bot',
    'oidc-subject',
    'npm-account',
    'github-user',
    'github-app',
    'ssh-key',
    'gpg-key',
  ]),
  id: Schema.String,
}) {
  static is = Schema.is(PrincipalRef)
  static decode = Schema.decodeUnknownEffect(PrincipalRef)
  static decodeSync = Schema.decodeUnknownSync(PrincipalRef)
  static encode = Schema.encodeUnknownEffect(PrincipalRef)
  static encodeSync = Schema.encodeUnknownSync(PrincipalRef)
  static equivalence = Schema.toEquivalence(PrincipalRef)
  static ordered = false as const
}

export class TrustRootRef extends Schema.Class<TrustRootRef>('TrustRootRef')({
  id: Schema.String,
  source: Schema.Literals(['user-config', 'org-registry', 'protected-git-ref', 'sigstore-issuer']),
  location: Schema.String,
  digest: Digest,
}) {
  static is = Schema.is(TrustRootRef)
  static decode = Schema.decodeUnknownEffect(TrustRootRef)
  static decodeSync = Schema.decodeUnknownSync(TrustRootRef)
  static encode = Schema.encodeUnknownEffect(TrustRootRef)
  static encodeSync = Schema.encodeUnknownSync(TrustRootRef)
  static equivalence = Schema.toEquivalence(TrustRootRef)
  static ordered = false as const
}

export class SigningIdentityProfile extends Schema.Class<SigningIdentityProfile>(
  'SigningIdentityProfile',
)({
  id: Schema.String,
  keySource: Schema.Literals(['ssh-agent', 'keychain', 'sigstore-oidc', 'gpg-keyring']),
  trustRoot: TrustRootRef,
  allowedSigners: Schema.Array(PrincipalRef),
  revokedSigners: Schema.Array(PrincipalRef),
  requiredSignatures: Schema.Number,
}) {
  static is = Schema.is(SigningIdentityProfile)
  static decode = Schema.decodeUnknownEffect(SigningIdentityProfile)
  static decodeSync = Schema.decodeUnknownSync(SigningIdentityProfile)
  static encode = Schema.encodeUnknownEffect(SigningIdentityProfile)
  static encodeSync = Schema.encodeUnknownSync(SigningIdentityProfile)
  static equivalence = Schema.toEquivalence(SigningIdentityProfile)
  static ordered = false as const
}

export class RegistryProfile extends Schema.Class<RegistryProfile>('RegistryProfile')({
  id: Schema.String,
  protocol: Schema.Literal('npm-registry-api'),
  url: Schema.String,
  authKind: Schema.Literals(['npm-token', 'oidc-trusted-publisher', 'basic', 'bearer-token']),
  strictSsl: Schema.Boolean,
  caFile: Schema.optional(Fs.Path.AbsFile.Schema),
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {
  static is = Schema.is(RegistryProfile)
  static decode = Schema.decodeUnknownEffect(RegistryProfile)
  static decodeSync = Schema.decodeUnknownSync(RegistryProfile)
  static encode = Schema.encodeUnknownEffect(RegistryProfile)
  static encodeSync = Schema.encodeUnknownSync(RegistryProfile)
  static equivalence = Schema.toEquivalence(RegistryProfile)
  static ordered = false as const
}

export class GithubHostProfile extends Schema.Class<GithubHostProfile>('GithubHostProfile')({
  id: Schema.String,
  kind: Schema.Literals(['github.com', 'github-enterprise']),
  apiUrl: Schema.String,
  webUrl: Schema.String,
  oidcIssuer: Schema.optional(Schema.String),
}) {
  static is = Schema.is(GithubHostProfile)
  static decode = Schema.decodeUnknownEffect(GithubHostProfile)
  static decodeSync = Schema.decodeUnknownSync(GithubHostProfile)
  static encode = Schema.encodeUnknownEffect(GithubHostProfile)
  static encodeSync = Schema.encodeUnknownSync(GithubHostProfile)
  static equivalence = Schema.toEquivalence(GithubHostProfile)
  static ordered = false as const
}

export class PublishProfile extends Schema.Class<PublishProfile>('PublishProfile')({
  id: Schema.String,
  packDriver: PublishDriverId,
  publishInvoker: PublishDriverId,
  registryClient: Schema.String,
  credentialProvider: Schema.String,
  trustedPublisherAdmin: Schema.optional(Schema.String),
}) {
  static is = Schema.is(PublishProfile)
  static decode = Schema.decodeUnknownEffect(PublishProfile)
  static decodeSync = Schema.decodeUnknownSync(PublishProfile)
  static encode = Schema.encodeUnknownEffect(PublishProfile)
  static encodeSync = Schema.encodeUnknownSync(PublishProfile)
  static equivalence = Schema.toEquivalence(PublishProfile)
  static ordered = false as const
}

export const OtpPolicy = Schema.Union([
  Schema.Struct({ mode: Schema.Literal('forbidden') }),
  Schema.Struct({ mode: Schema.Literal('env'), env: Schema.String }),
  Schema.Struct({ mode: Schema.Literal('interactive') }),
])
export type OtpPolicy = typeof OtpPolicy.Type

export const CredentialSource = Schema.Literals(['trusted-oidc', 'token-env', 'local-session'])
export type CredentialSource = typeof CredentialSource.Type

export class CredentialIntent extends Schema.Class<CredentialIntent>('CredentialIntent')({
  source: CredentialSource,
  runtimeHost: RuntimeHost,
  tokenEnv: Schema.optional(Schema.String),
  otpPolicy: OtpPolicy,
  interactiveAllowed: Schema.Boolean,
  secretPersistence: Schema.Literal('never'),
  redaction: Schema.Literal('required'),
}) {
  static is = Schema.is(CredentialIntent)
  static decode = Schema.decodeUnknownEffect(CredentialIntent)
  static decodeSync = Schema.decodeUnknownSync(CredentialIntent)
  static encode = Schema.encodeUnknownEffect(CredentialIntent)
  static encodeSync = Schema.encodeUnknownSync(CredentialIntent)
  static equivalence = Schema.toEquivalence(CredentialIntent)
  static ordered = false as const
}

export const ProvenanceMode = Schema.Literals([
  'none',
  'trusted-publisher',
  'cli-flag',
  'attestation-file',
])
export type ProvenanceMode = typeof ProvenanceMode.Type

export class ProvenanceIntent extends Schema.Class<ProvenanceIntent>('ProvenanceIntent')({
  mode: ProvenanceMode,
  required: Schema.Boolean,
  provider: Schema.optional(Schema.Literals(['npm-github', 'npm-gitlab', 'npm-circleci'])),
  file: Schema.optional(Fs.Path.AbsFile.Schema),
}) {
  static is = Schema.is(ProvenanceIntent)
  static decode = Schema.decodeUnknownEffect(ProvenanceIntent)
  static decodeSync = Schema.decodeUnknownSync(ProvenanceIntent)
  static encode = Schema.encodeUnknownEffect(ProvenanceIntent)
  static encodeSync = Schema.encodeUnknownSync(ProvenanceIntent)
  static equivalence = Schema.toEquivalence(ProvenanceIntent)
  static ordered = false as const
}

export class ScriptPolicy extends Schema.Class<ScriptPolicy>('ScriptPolicy')({
  default: Schema.Literals(['deny', 'allow-listed']),
  allowlist: Schema.Array(
    Schema.Struct({
      packageName: Pkg.Moniker.FromString,
      script: Schema.Literals(['prepack', 'prepare', 'postpack', 'prepublishOnly']),
      commandSha256: Digest,
      packageSourceDigest: Digest,
    }),
  ),
  envAllowlist: Schema.Array(Schema.String),
  network: Schema.Literals(['deny-enforced', 'declared-deny', 'allow']),
}) {
  static is = Schema.is(ScriptPolicy)
  static decode = Schema.decodeUnknownEffect(ScriptPolicy)
  static decodeSync = Schema.decodeUnknownSync(ScriptPolicy)
  static encode = Schema.encodeUnknownEffect(ScriptPolicy)
  static encodeSync = Schema.encodeUnknownSync(ScriptPolicy)
  static equivalence = Schema.toEquivalence(ScriptPolicy)
  static ordered = false as const
}

export class EnginePolicy extends Schema.Class<EnginePolicy>('EnginePolicy')({
  node: Schema.Literals(['match-runtime', 'allow-compatible-range']),
  packageManager: Schema.Literals(['match-plan', 'allow-compatible-range']),
}) {
  static is = Schema.is(EnginePolicy)
  static decode = Schema.decodeUnknownEffect(EnginePolicy)
  static decodeSync = Schema.decodeUnknownSync(EnginePolicy)
  static encode = Schema.encodeUnknownEffect(EnginePolicy)
  static encodeSync = Schema.encodeUnknownSync(EnginePolicy)
  static equivalence = Schema.toEquivalence(EnginePolicy)
  static ordered = false as const
}

export class ArtifactPolicy extends Schema.Class<ArtifactPolicy>('ArtifactPolicy')({
  scriptPolicy: ScriptPolicy,
  enginePolicy: EnginePolicy,
  forbiddenFilePatterns: Schema.Array(Schema.String),
  deterministicApply: Schema.Literal(true),
}) {
  static is = Schema.is(ArtifactPolicy)
  static decode = Schema.decodeUnknownEffect(ArtifactPolicy)
  static decodeSync = Schema.decodeUnknownSync(ArtifactPolicy)
  static encode = Schema.encodeUnknownEffect(ArtifactPolicy)
  static encodeSync = Schema.encodeUnknownSync(ArtifactPolicy)
  static equivalence = Schema.toEquivalence(ArtifactPolicy)
  static ordered = false as const
}

export class GitSideEffectIntent extends Schema.Class<GitSideEffectIntent>('GitSideEffectIntent')({
  remote: Schema.String,
  trunk: Schema.String,
  forcePushTag: Schema.Boolean,
  atomicTagPush: Schema.Boolean,
}) {
  static is = Schema.is(GitSideEffectIntent)
  static decode = Schema.decodeUnknownEffect(GitSideEffectIntent)
  static decodeSync = Schema.decodeUnknownSync(GitSideEffectIntent)
  static encode = Schema.encodeUnknownEffect(GitSideEffectIntent)
  static encodeSync = Schema.encodeUnknownSync(GitSideEffectIntent)
  static equivalence = Schema.toEquivalence(GitSideEffectIntent)
  static ordered = false as const
}

export class GithubReleaseIntent extends Schema.Class<GithubReleaseIntent>('GithubReleaseIntent')({
  host: GithubHostProfile,
  repository: Schema.String,
  style: Schema.Literals(['versioned', 'dist-tagged']),
  existingReleasePolicy: Schema.Literals(['fail', 'update-if-owned', 'adopt-if-matching']),
}) {
  static is = Schema.is(GithubReleaseIntent)
  static decode = Schema.decodeUnknownEffect(GithubReleaseIntent)
  static decodeSync = Schema.decodeUnknownSync(GithubReleaseIntent)
  static encode = Schema.encodeUnknownEffect(GithubReleaseIntent)
  static encodeSync = Schema.encodeUnknownSync(GithubReleaseIntent)
  static equivalence = Schema.toEquivalence(GithubReleaseIntent)
  static ordered = false as const
}

export class PublishIntent extends Schema.Class<PublishIntent>('PublishIntent')({
  profile: PublishProfile,
  registry: RegistryProfile,
  access: Schema.Union([
    Schema.Struct({ mode: Schema.Literal('omit') }),
    Schema.Struct({
      mode: Schema.Literal('publish-access'),
      value: Schema.Literals(['public', 'restricted']),
    }),
  ]),
  lifecycle: LifecycleSchema,
  channel: PublishChannel,
  distTag: Schema.String,
  prerelease: Schema.Boolean,
  forcePushTag: Schema.Boolean,
  githubReleaseStyle: Schema.Literals(['versioned', 'dist-tagged']),
  auth: CredentialIntent,
  provenance: ProvenanceIntent,
  artifacts: ArtifactPolicy,
  git: GitSideEffectIntent,
  github: GithubReleaseIntent,
}) {
  static is = Schema.is(PublishIntent)
  static decode = Schema.decodeUnknownEffect(PublishIntent)
  static decodeSync = Schema.decodeUnknownSync(PublishIntent)
  static encode = Schema.encodeUnknownEffect(PublishIntent)
  static encodeSync = Schema.encodeUnknownSync(PublishIntent)
  static equivalence = Schema.toEquivalence(PublishIntent)
  static ordered = false as const
}

export const ProofStatus = Schema.Literals([
  'proven',
  'failed',
  'unprovable',
  'deferredToHost',
  'blocked',
])
export type ProofStatus = typeof ProofStatus.Type

export const ProofRecheckMode = Schema.Literals([
  'pre-apply',
  'pre-each-mutation',
  'pre-apply-and-on-mutation-failure',
])
export type ProofRecheckMode = typeof ProofRecheckMode.Type

export class ProofPolicy extends Schema.Class<ProofPolicy>('ProofPolicy')({
  requiredStatuses: Schema.Array(ProofStatus),
  authProofTtlSeconds: Schema.Number,
  registryProofTtlSeconds: Schema.Number,
  maxClockSkewSeconds: Schema.Number,
  defaultRecheckMode: ProofRecheckMode,
  hostDeferral: Schema.Struct({
    allowed: Schema.Boolean,
    runtimeHosts: Schema.Array(RuntimeHost),
  }),
  byteVerifyRegistryTarball: Schema.Literals(['always', 'official-only', 'never']),
}) {
  static is = Schema.is(ProofPolicy)
  static decode = Schema.decodeUnknownEffect(ProofPolicy)
  static decodeSync = Schema.decodeUnknownSync(ProofPolicy)
  static encode = Schema.encodeUnknownEffect(ProofPolicy)
  static encodeSync = Schema.encodeUnknownSync(ProofPolicy)
  static equivalence = Schema.toEquivalence(ProofPolicy)
  static ordered = false as const
}

export class PlanDigest extends Schema.Class<PlanDigest>('PlanDigest')({
  algorithm: Schema.Literal('sha256'),
  value: Schema.String,
}) {
  static is = Schema.is(PlanDigest)
  static decode = Schema.decodeUnknownEffect(PlanDigest)
  static decodeSync = Schema.decodeUnknownSync(PlanDigest)
  static encode = Schema.encodeUnknownEffect(PlanDigest)
  static encodeSync = Schema.encodeUnknownSync(PlanDigest)
  static equivalence = Schema.toEquivalence(PlanDigest)
  static ordered = false as const
}

export class PlanSourceSnapshot extends Schema.Class<PlanSourceSnapshot>('PlanSourceSnapshot')({
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
}) {
  static is = Schema.is(PlanSourceSnapshot)
  static decode = Schema.decodeUnknownEffect(PlanSourceSnapshot)
  static decodeSync = Schema.decodeUnknownSync(PlanSourceSnapshot)
  static encode = Schema.encodeUnknownEffect(PlanSourceSnapshot)
  static encodeSync = Schema.encodeUnknownSync(PlanSourceSnapshot)
  static equivalence = Schema.toEquivalence(PlanSourceSnapshot)
  static ordered = false as const
}

export class PlanBody extends Schema.Class<PlanBody>('PlanBody')({
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
}) {
  static is = Schema.is(PlanBody)
  static decode = Schema.decodeUnknownEffect(PlanBody)
  static decodeSync = Schema.decodeUnknownSync(PlanBody)
  static encode = Schema.encodeUnknownEffect(PlanBody)
  static encodeSync = Schema.encodeUnknownSync(PlanBody)
  static equivalence = Schema.toEquivalence(PlanBody)
  static ordered = false as const
}

export class DetachedSignature extends Schema.Class<DetachedSignature>('DetachedSignature')({
  algorithm: Schema.Literals(['sigstore-keyless', 'ssh-signature', 'gpg']),
  signer: Schema.String,
  signature: Schema.String,
}) {
  static is = Schema.is(DetachedSignature)
  static decode = Schema.decodeUnknownEffect(DetachedSignature)
  static decodeSync = Schema.decodeUnknownSync(DetachedSignature)
  static encode = Schema.encodeUnknownEffect(DetachedSignature)
  static encodeSync = Schema.encodeUnknownSync(DetachedSignature)
  static equivalence = Schema.toEquivalence(DetachedSignature)
  static ordered = false as const
}

export class PlanEnvelope extends Schema.Class<PlanEnvelope>('PlanEnvelope')({
  schemaVersion: Schema.Literal(1),
  digest: PlanDigest,
  body: PlanBody,
  signature: DetachedSignature,
}) {
  static is = Schema.is(PlanEnvelope)
  static decode = Schema.decodeUnknownEffect(PlanEnvelope)
  static decodeSync = Schema.decodeUnknownSync(PlanEnvelope)
  static encode = Schema.encodeUnknownEffect(PlanEnvelope)
  static encodeSync = Schema.encodeUnknownSync(PlanEnvelope)
  static equivalence = Schema.toEquivalence(PlanEnvelope)
  static ordered = false as const
}

export class ProofTransition extends Schema.Class<ProofTransition>('ProofTransition')({
  from: Schema.optional(ProofStatus),
  to: ProofStatus,
  at: Schema.String,
  reason: Schema.String,
}) {
  static is = Schema.is(ProofTransition)
  static decode = Schema.decodeUnknownEffect(ProofTransition)
  static decodeSync = Schema.decodeUnknownSync(ProofTransition)
  static encode = Schema.encodeUnknownEffect(ProofTransition)
  static encodeSync = Schema.encodeUnknownSync(ProofTransition)
  static equivalence = Schema.toEquivalence(ProofTransition)
  static ordered = false as const
}

export class ProofRecord extends Schema.Class<ProofRecord>('ProofRecord')({
  id: Schema.String,
  status: ProofStatus,
  dependsOn: Schema.Array(Schema.String),
  recheckMode: ProofRecheckMode,
  observedAt: Schema.String,
  expiresAt: Schema.optional(Schema.String),
  evidence: JsonRecord,
  proofHistory: Schema.Array(ProofTransition),
}) {
  static is = Schema.is(ProofRecord)
  static decode = Schema.decodeUnknownEffect(ProofRecord)
  static decodeSync = Schema.decodeUnknownSync(ProofRecord)
  static encode = Schema.encodeUnknownEffect(ProofRecord)
  static encodeSync = Schema.encodeUnknownSync(ProofRecord)
  static equivalence = Schema.toEquivalence(ProofRecord)
  static ordered = false as const
}

export class ProofArtifact extends Schema.Class<ProofArtifact>('ProofArtifact')({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
  records: Schema.Array(ProofRecord),
}) {
  static is = Schema.is(ProofArtifact)
  static decode = Schema.decodeUnknownEffect(ProofArtifact)
  static decodeSync = Schema.decodeUnknownSync(ProofArtifact)
  static encode = Schema.encodeUnknownEffect(ProofArtifact)
  static encodeSync = Schema.encodeUnknownSync(ProofArtifact)
  static equivalence = Schema.toEquivalence(ProofArtifact)
  static ordered = false as const
}

export class RegistryObservation extends Schema.Class<RegistryObservation>('RegistryObservation')({
  packageName: Pkg.Moniker.FromString,
  version: Semver.Schema,
  registry: Schema.String,
  observedAt: Schema.String,
  versionMetadata: JsonRecord,
  distTags: Schema.Record(Schema.String, Schema.String),
  accessStatus: Schema.optional(Schema.Literals(['public', 'private', 'restricted', 'unknown'])),
  tarballUrl: Schema.optional(Schema.String),
  shasum: Schema.optional(Schema.String),
  integrity: Schema.optional(Schema.String),
  downloadedTarballSha256: Schema.optional(Digest),
}) {
  static is = Schema.is(RegistryObservation)
  static decode = Schema.decodeUnknownEffect(RegistryObservation)
  static decodeSync = Schema.decodeUnknownSync(RegistryObservation)
  static encode = Schema.encodeUnknownEffect(RegistryObservation)
  static encodeSync = Schema.encodeUnknownSync(RegistryObservation)
  static equivalence = Schema.toEquivalence(RegistryObservation)
  static ordered = false as const
}

export class PublishReceipt extends Schema.Class<PublishReceipt>('PublishReceipt')({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
  tarballSha256: Digest,
  observation: RegistryObservation,
  verifiedAt: Schema.String,
}) {
  static is = Schema.is(PublishReceipt)
  static decode = Schema.decodeUnknownEffect(PublishReceipt)
  static decodeSync = Schema.decodeUnknownSync(PublishReceipt)
  static encode = Schema.encodeUnknownEffect(PublishReceipt)
  static encodeSync = Schema.encodeUnknownSync(PublishReceipt)
  static equivalence = Schema.toEquivalence(PublishReceipt)
  static ordered = false as const
}

export class ArtifactManifest extends Schema.Class<ArtifactManifest>('ArtifactManifest')({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
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
}) {
  static is = Schema.is(ArtifactManifest)
  static decode = Schema.decodeUnknownEffect(ArtifactManifest)
  static decodeSync = Schema.decodeUnknownSync(ArtifactManifest)
  static encode = Schema.encodeUnknownEffect(ArtifactManifest)
  static encodeSync = Schema.encodeUnknownSync(ArtifactManifest)
  static equivalence = Schema.toEquivalence(ArtifactManifest)
  static ordered = false as const
}

export const SideEffectKind = Schema.Literals([
  'registry-publish',
  'registry-dist-tag',
  'git-tag-create',
  'git-tag-push',
  'github-release-create',
  'github-release-update',
])
export type SideEffectKind = typeof SideEffectKind.Type

export class SideEffectEntry extends Schema.Class<SideEffectEntry>('SideEffectEntry')({
  entryId: Schema.String,
  prevEntrySha256: Schema.optional(Digest),
  entrySha256: Digest,
  planDigest: PlanDigest,
  kind: SideEffectKind,
  subject: Schema.String,
  idempotencyKey: Schema.String,
  planned: JsonRecord,
  attemptedAt: Schema.String,
  result: Schema.Literals(['attempting', 'succeeded', 'failed']),
}) {
  static is = Schema.is(SideEffectEntry)
  static decode = Schema.decodeUnknownEffect(SideEffectEntry)
  static decodeSync = Schema.decodeUnknownSync(SideEffectEntry)
  static encode = Schema.encodeUnknownEffect(SideEffectEntry)
  static encodeSync = Schema.encodeUnknownSync(SideEffectEntry)
  static equivalence = Schema.toEquivalence(SideEffectEntry)
  static ordered = false as const
}

export class FailureObservation extends Schema.Class<FailureObservation>('FailureObservation')({
  at: Schema.String,
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
}) {
  static is = Schema.is(FailureObservation)
  static decode = Schema.decodeUnknownEffect(FailureObservation)
  static decodeSync = Schema.decodeUnknownSync(FailureObservation)
  static encode = Schema.encodeUnknownEffect(FailureObservation)
  static encodeSync = Schema.encodeUnknownSync(FailureObservation)
  static equivalence = Schema.toEquivalence(FailureObservation)
  static ordered = false as const
}

export class ExecutionPrincipals extends Schema.Class<ExecutionPrincipals>('ExecutionPrincipals')({
  invoker: PrincipalRef,
  planSigner: PrincipalRef,
  publisher: Schema.optional(PrincipalRef),
  runtimeHost: Schema.optional(PrincipalRef),
  gitHubActor: Schema.optional(PrincipalRef),
  lockOwner: PrincipalRef,
}) {
  static is = Schema.is(ExecutionPrincipals)
  static decode = Schema.decodeUnknownEffect(ExecutionPrincipals)
  static decodeSync = Schema.decodeUnknownSync(ExecutionPrincipals)
  static encode = Schema.encodeUnknownEffect(ExecutionPrincipals)
  static encodeSync = Schema.encodeUnknownSync(ExecutionPrincipals)
  static equivalence = Schema.toEquivalence(ExecutionPrincipals)
  static ordered = false as const
}

export class ExecutionJournal extends Schema.Class<ExecutionJournal>('ExecutionJournal')({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
  workflowExecutionId: Schema.String,
  principals: ExecutionPrincipals,
  sideEffects: Schema.Array(SideEffectEntry),
  observations: Schema.Array(JsonRecord),
  failures: Schema.Array(FailureObservation),
}) {
  static is = Schema.is(ExecutionJournal)
  static decode = Schema.decodeUnknownEffect(ExecutionJournal)
  static decodeSync = Schema.decodeUnknownSync(ExecutionJournal)
  static encode = Schema.encodeUnknownEffect(ExecutionJournal)
  static encodeSync = Schema.encodeUnknownSync(ExecutionJournal)
  static equivalence = Schema.toEquivalence(ExecutionJournal)
  static ordered = false as const
}

export class ExecutionLock extends Schema.Class<ExecutionLock>('ExecutionLock')({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
  owner: PrincipalRef,
  ownerHost: Schema.String,
  ownerProcess: Schema.String,
  acquiredAt: Schema.String,
  heartbeatAt: Schema.String,
  expiresAt: Schema.String,
  backend: Schema.Literals(['local-file', 'remote-git-ref']),
  remoteRef: Schema.optional(Schema.String),
  recoveryRequiresSignature: Schema.Boolean,
}) {
  static is = Schema.is(ExecutionLock)
  static decode = Schema.decodeUnknownEffect(ExecutionLock)
  static decodeSync = Schema.decodeUnknownSync(ExecutionLock)
  static encode = Schema.encodeUnknownEffect(ExecutionLock)
  static encodeSync = Schema.encodeUnknownSync(ExecutionLock)
  static equivalence = Schema.toEquivalence(ExecutionLock)
  static ordered = false as const
}

export class WorkflowCallProofLink extends Schema.Class<WorkflowCallProofLink>(
  'WorkflowCallProofLink',
)({
  workflowFile: Fs.Path.RelFile.Schema,
  jobId: Schema.String,
  caller: Schema.optional(Schema.String),
  effectivePermissions: Schema.Record(Schema.String, Schema.String),
  passesIdTokenWrite: Schema.Boolean,
  passesContentsWrite: Schema.Boolean,
}) {
  static is = Schema.is(WorkflowCallProofLink)
  static decode = Schema.decodeUnknownEffect(WorkflowCallProofLink)
  static decodeSync = Schema.decodeUnknownSync(WorkflowCallProofLink)
  static encode = Schema.encodeUnknownEffect(WorkflowCallProofLink)
  static encodeSync = Schema.encodeUnknownSync(WorkflowCallProofLink)
  static equivalence = Schema.toEquivalence(WorkflowCallProofLink)
  static ordered = false as const
}

export const ReconcileClassification = Schema.Literals(['clean', 'resume', 'repair', 'abort'])
export type ReconcileClassification = typeof ReconcileClassification.Type

export class ReconcileDecision extends Schema.Class<ReconcileDecision>('ReconcileDecision')({
  classification: ReconcileClassification,
  planDigest: PlanDigest,
  evidenceIds: Schema.Array(Schema.String),
  stateDiff: Schema.Array(Schema.String),
  nextCommand: Schema.String,
}) {
  static is = Schema.is(ReconcileDecision)
  static decode = Schema.decodeUnknownEffect(ReconcileDecision)
  static decodeSync = Schema.decodeUnknownSync(ReconcileDecision)
  static encode = Schema.encodeUnknownEffect(ReconcileDecision)
  static encodeSync = Schema.encodeUnknownSync(ReconcileDecision)
  static equivalence = Schema.toEquivalence(ReconcileDecision)
  static ordered = false as const
}

export const RepairAction = Schema.Literals([
  'resume',
  'record-remote-success',
  'create-missing-tag',
  'create-missing-github-release',
  'abort-before-mutation',
  'manual-intervention',
])
export type RepairAction = typeof RepairAction.Type

export class AuditArchiveManifest extends Schema.Class<AuditArchiveManifest>(
  'AuditArchiveManifest',
)({
  schemaVersion: Schema.Literal(1),
  planDigest: PlanDigest,
  createdAt: Schema.String,
  files: Schema.Array(
    Schema.Struct({
      path: Fs.Path.RelFile.Schema,
      sha256: Digest,
    }),
  ),
  signature: DetachedSignature,
}) {
  static is = Schema.is(AuditArchiveManifest)
  static decode = Schema.decodeUnknownEffect(AuditArchiveManifest)
  static decodeSync = Schema.decodeUnknownSync(AuditArchiveManifest)
  static encode = Schema.encodeUnknownEffect(AuditArchiveManifest)
  static encodeSync = Schema.encodeUnknownSync(AuditArchiveManifest)
  static equivalence = Schema.toEquivalence(AuditArchiveManifest)
  static ordered = false as const
}

export const defaultScriptPolicy = (): ScriptPolicy =>
  ScriptPolicy.make({
    default: 'deny',
    allowlist: [],
    envAllowlist: [],
    network: 'deny-enforced',
  })

export const defaultArtifactPolicy = (): ArtifactPolicy =>
  ArtifactPolicy.make({
    scriptPolicy: defaultScriptPolicy(),
    enginePolicy: EnginePolicy.make({
      node: 'match-runtime',
      packageManager: 'match-plan',
    }),
    forbiddenFilePatterns: [
      '.npmrc',
      '.env',
      '*.pem',
      '*id_rsa*',
      '*id_ed25519*',
      '.aws/credentials',
      '.config/gcloud/*',
    ],
    deterministicApply: true,
  })

export const defaultProofPolicy = (runtimeHost: RuntimeHost = 'local-interactive'): ProofPolicy =>
  ProofPolicy.make({
    requiredStatuses: ['proven'],
    authProofTtlSeconds: runtimeHost === 'local-interactive' ? 86_400 : 3_600,
    registryProofTtlSeconds: runtimeHost === 'local-interactive' ? 3_600 : 1_800,
    maxClockSkewSeconds: 300,
    defaultRecheckMode: 'pre-apply',
    hostDeferral: { allowed: false, runtimeHosts: [] },
    byteVerifyRegistryTarball: 'always',
  })

export const defaultRegistryProfile = (): RegistryProfile =>
  RegistryProfile.make({
    id: 'npmjs',
    protocol: 'npm-registry-api',
    url: 'https://registry.npmjs.org/',
    authKind: 'npm-token',
    strictSsl: true,
  })

export const defaultGithubHostProfile = (): GithubHostProfile =>
  GithubHostProfile.make({
    id: 'github.com',
    kind: 'github.com',
    apiUrl: 'https://api.github.com',
    webUrl: 'https://github.com',
    oidcIssuer: 'https://token.actions.githubusercontent.com',
  })

export const publishIntentFromSemantics = (params: {
  readonly semantics: PublishSemantics
  readonly trunk: string
  readonly registry?: string
  readonly packageManager?: PublishDriverId
}): PublishIntent =>
  PublishIntent.make({
    profile: PublishProfile.make({
      id: `${params.packageManager ?? 'npm'}-tarball`,
      packDriver: params.packageManager ?? 'npm',
      publishInvoker: params.packageManager ?? 'npm',
      registryClient: 'npm-registry-api',
      credentialProvider: params.semantics.channel.mode,
      trustedPublisherAdmin:
        params.semantics.channel.mode === 'github-trusted' ? 'npm-trust' : undefined,
    }),
    registry:
      params.registry === undefined
        ? defaultRegistryProfile()
        : RegistryProfile.make(
            Object.assign({}, defaultRegistryProfile(), { url: params.registry }),
          ),
    access: { mode: 'publish-access', value: 'public' },
    lifecycle: params.semantics.lifecycle,
    channel: params.semantics.channel,
    distTag: params.semantics.distTag,
    prerelease: params.semantics.prerelease,
    forcePushTag: params.semantics.forcePushTag,
    githubReleaseStyle: params.semantics.githubReleaseStyle,
    auth: CredentialIntent.make({
      source: params.semantics.channel.mode === 'github-trusted' ? 'trusted-oidc' : 'token-env',
      runtimeHost:
        params.semantics.channel.mode === 'github-trusted' ? 'github-actions' : 'local-interactive',
      tokenEnv:
        params.semantics.channel.mode === 'github-token'
          ? params.semantics.channel.tokenEnv
          : params.semantics.channel.mode === 'manual'
            ? 'NPM_TOKEN'
            : undefined,
      otpPolicy: { mode: 'interactive' },
      interactiveAllowed: params.semantics.channel.mode === 'manual',
      secretPersistence: 'never',
      redaction: 'required',
    }),
    provenance: ProvenanceIntent.make({
      mode: params.semantics.channel.mode === 'github-trusted' ? 'trusted-publisher' : 'none',
      required: false,
      provider: params.semantics.channel.mode === 'github-trusted' ? 'npm-github' : undefined,
    }),
    artifacts: defaultArtifactPolicy(),
    git: GitSideEffectIntent.make({
      remote: 'origin',
      trunk: params.trunk,
      forcePushTag: params.semantics.forcePushTag,
      atomicTagPush: params.semantics.lifecycle === 'official',
    }),
    github: GithubReleaseIntent.make({
      host: defaultGithubHostProfile(),
      repository: 'origin',
      style: params.semantics.githubReleaseStyle,
      existingReleasePolicy:
        params.semantics.githubReleaseStyle === 'dist-tagged' ? 'update-if-owned' : 'fail',
    }),
  })

export const digestPlanBody = (body: PlanBody): PlanDigest => {
  const digest = sha256Json(Schema.encodeSync(PlanBody)(body))
  return PlanDigest.make(digest)
}

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
