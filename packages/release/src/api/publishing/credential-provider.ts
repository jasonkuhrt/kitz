import type { Effect, Option } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { AuthIdentityProof, OtpSecret } from './results.js'
import type { OtpRequest, WhoamiRequest } from './requests.js'

export interface CredentialProvider {
  readonly whoami: (
    request: WhoamiRequest,
  ) => Effect.Effect<AuthIdentityProof, PublishingCapabilityError>
  readonly resolveOtp: (
    request: OtpRequest,
  ) => Effect.Effect<Option.Option<OtpSecret>, PublishingCapabilityError>
}
