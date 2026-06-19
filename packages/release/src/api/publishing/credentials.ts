import { Context, Effect, Option } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { AuthIdentityProof, OtpSecret, TrustedPublisherProof } from './results.js'
import type {
  OtpRequest,
  TrustedPublisherQuery,
  TrustedPublisherSetup,
  WhoamiRequest,
} from './requests.js'

export interface CredentialsService {
  readonly whoami: (
    request: WhoamiRequest,
  ) => Effect.Effect<AuthIdentityProof, PublishingCapabilityError>
  readonly resolveOtp: (
    request: OtpRequest,
  ) => Effect.Effect<Option.Option<OtpSecret>, PublishingCapabilityError>
  readonly trustedPublishers: (
    request: TrustedPublisherQuery,
  ) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
  readonly setupTrustedPublisher: (
    request: TrustedPublisherSetup,
  ) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
}

export class Credentials extends Context.Service<Credentials, CredentialsService>()(
  'credentials',
) {}
