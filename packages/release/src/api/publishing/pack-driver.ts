import type { Effect } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { PublishCapability } from './models/capability.js'
import type { PublishDriverId } from './models/driver-id.js'
import type { DriverVersionProof, PackedArtifact, SubcommandProof } from './models/proof.js'
import type { PackRequest, SubcommandProofRequest } from './requests.js'

export interface PackDriver {
  readonly id: PublishDriverId
  readonly capabilities: ReadonlySet<PublishCapability>
  readonly version: Effect.Effect<DriverVersionProof, PublishingCapabilityError>
  readonly proveSubcommands: (
    request: SubcommandProofRequest,
  ) => Effect.Effect<SubcommandProof, PublishingCapabilityError>
  readonly pack: (request: PackRequest) => Effect.Effect<PackedArtifact, PublishingCapabilityError>
}
