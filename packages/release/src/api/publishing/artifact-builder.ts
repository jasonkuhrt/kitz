import type { Effect } from 'effect'
import type { ArtifactManifest } from '../release-contract.js'
import type { PublishingCapabilityError } from './errors.js'
import type { PackRequest } from './requests.js'

export interface ArtifactBuildRequest extends PackRequest {
  readonly manifestTransform: Readonly<Record<string, unknown>>
}

export interface ArtifactBuilder {
  readonly build: (
    request: ArtifactBuildRequest,
  ) => Effect.Effect<ArtifactManifest, PublishingCapabilityError>
}
