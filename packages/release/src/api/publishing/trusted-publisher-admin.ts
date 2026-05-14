import type { Effect } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { TrustedPublisherProof } from './results.js'
import type { TrustedPublisherQuery, TrustedPublisherSetup } from './requests.js'

export interface TrustedPublisherAdmin {
  readonly trustedPublishers: (
    request: TrustedPublisherQuery,
  ) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
  readonly setupTrustedPublisher: (
    request: TrustedPublisherSetup,
  ) => Effect.Effect<TrustedPublisherProof, PublishingCapabilityError>
}
