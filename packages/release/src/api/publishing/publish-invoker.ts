import type { Effect } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { PublishCapability } from './models/capability.js'
import type { PublishDriverId } from './models/driver-id.js'
import type { PublishDryRunProof, PublishReceipt } from './models/proof.js'
import type { PublishRequest } from './requests.js'

export interface PublishInvoker {
  readonly id: PublishDriverId
  readonly capabilities: ReadonlySet<PublishCapability>
  readonly dryRunPublish: (
    request: PublishRequest,
  ) => Effect.Effect<PublishDryRunProof, PublishingCapabilityError>
  readonly publish: (
    request: PublishRequest,
  ) => Effect.Effect<PublishReceipt, PublishingCapabilityError>
}
