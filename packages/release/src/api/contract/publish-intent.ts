/**
 * @module api/contract/publish-intent
 *
 * The frozen publish intent: credentials, provenance, artifact policy, and
 * git/GitHub side-effect intents resolved before any mutation runs.
 */
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'
import { type PublishSemantics, PublishChannel } from '../publishing.js'
import { PublishDriverId } from '../publishing/models/driver-id.js'
import { LifecycleSchema } from '../version/models/lifecycle.js'
import {
  defaultGithubHostProfile,
  defaultRegistryProfile,
  GithubHostProfile,
  PublishProfile,
  RegistryProfile,
} from './registry.js'
import { RuntimeHost } from './trust.js'

export const OtpPolicy = Schema.Union([
  Schema.Struct({ mode: Schema.Literal('forbidden') }),
  Schema.Struct({ mode: Schema.Literal('env'), env: Schema.String }),
  Schema.Struct({ mode: Schema.Literal('interactive') }),
])
export type OtpPolicy = typeof OtpPolicy.Type

export const CredentialSource = Schema.Literals(['trusted-oidc', 'token-env', 'local-session'])
export type CredentialSource = typeof CredentialSource.Type

export class CredentialIntent extends Sch.Class<CredentialIntent>()('CredentialIntent', {
  source: CredentialSource,
  runtimeHost: RuntimeHost,
  tokenEnv: Schema.optional(Schema.String),
  otpPolicy: OtpPolicy,
  interactiveAllowed: Schema.Boolean,
  secretPersistence: Schema.Literal('never'),
  redaction: Schema.Literal('required'),
}) {}

export const ProvenanceMode = Schema.Literals([
  'none',
  'trusted-publisher',
  'cli-flag',
  'attestation-file',
])
export type ProvenanceMode = typeof ProvenanceMode.Type

export class ProvenanceIntent extends Sch.Class<ProvenanceIntent>()('ProvenanceIntent', {
  mode: ProvenanceMode,
  required: Schema.Boolean,
  provider: Schema.optional(Schema.Literals(['npm-github', 'npm-gitlab', 'npm-circleci'])),
  file: Schema.optional(Fs.Path.AbsFile.Schema),
}) {}

/**
 * Lifecycle-script policy for pack-time hooks (`prepack`, `prepare`,
 * `postpack`, `prepublishOnly`).
 *
 * The posture is deny-by-default: a pack hook may only run when an
 * {@link ScriptPolicy#allowlist} entry pins its exact command digest and the
 * package source digest it was reviewed against. Allowlisted hooks are still
 * subject to the {@link ScriptPolicy#network} policy: under `deny-enforced`,
 * an allowlisted hook remains unprovable until a pack-time network-denial
 * backend is active.
 */
export class ScriptPolicy extends Sch.Class<ScriptPolicy>()('ScriptPolicy', {
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
}) {}

export class EnginePolicy extends Sch.Class<EnginePolicy>()('EnginePolicy', {
  node: Schema.Literals(['match-runtime', 'allow-compatible-range']),
  packageManager: Schema.Literals(['match-plan', 'allow-compatible-range']),
}) {}

export class ArtifactPolicy extends Sch.Class<ArtifactPolicy>()('ArtifactPolicy', {
  scriptPolicy: ScriptPolicy,
  enginePolicy: EnginePolicy,
  forbiddenFilePatterns: Schema.Array(Schema.String),
  deterministicApply: Schema.Literal(true),
}) {}

export class GitSideEffectIntent extends Sch.Class<GitSideEffectIntent>()('GitSideEffectIntent', {
  remote: Schema.String,
  trunk: Schema.String,
  forcePushTag: Schema.Boolean,
  atomicTagPush: Schema.Boolean,
}) {}

export class GithubReleaseIntent extends Sch.Class<GithubReleaseIntent>()('GithubReleaseIntent', {
  host: GithubHostProfile,
  repository: Schema.String,
  style: Schema.Literals(['versioned', 'dist-tagged']),
  existingReleasePolicy: Schema.Literals(['fail', 'update-if-owned', 'adopt-if-matching']),
}) {}

export class PublishIntent extends Sch.Class<PublishIntent>()('PublishIntent', {
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
}) {}

export const defaultScriptPolicy = (): ScriptPolicy =>
  ScriptPolicy.make({
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
