/**
 * @module api/contract/trust
 *
 * Identity, signing, and trust-root contracts shared by plans, proofs, and
 * audit artifacts.
 */
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'

export const RuntimeHost = Schema.Literals([
  'local-interactive',
  'local-unattended',
  'github-actions',
  'gitlab-ci',
  'circleci',
])
export type RuntimeHost = typeof RuntimeHost.Type

export class PrincipalRef extends Sch.Class<PrincipalRef>()('PrincipalRef', {
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
}) {}

export class TrustRootRef extends Sch.Class<TrustRootRef>()('TrustRootRef', {
  id: Schema.String,
  source: Schema.Literals(['user-config', 'org-registry', 'protected-git-ref', 'sigstore-issuer']),
  location: Schema.String,
  digest: Digest,
}) {}

export class SigningIdentityProfile extends Sch.Class<SigningIdentityProfile>()(
  'SigningIdentityProfile',
  {
    id: Schema.String,
    keySource: Schema.Literals(['ssh-agent', 'keychain', 'sigstore-oidc', 'gpg-keyring']),
    trustRoot: TrustRootRef,
    allowedSigners: Schema.Array(PrincipalRef),
    revokedSigners: Schema.Array(PrincipalRef),
    requiredSignatures: Schema.Number,
  },
) {}

export class DetachedSignature extends Sch.Class<DetachedSignature>()('DetachedSignature', {
  algorithm: Schema.Literals(['sigstore-keyless', 'ssh-signature', 'gpg']),
  signer: Schema.String,
  signature: Schema.String,
}) {}
