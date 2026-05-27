import { Context, Effect } from 'effect'
import type { ArtifactManifest } from '../release-contract.js'
import type { PublishingCapabilityError } from './errors.js'
import type { ArtifactBuildRequest } from './requests.js'

export interface ArtifacterService {
  readonly build: (
    request: ArtifactBuildRequest,
  ) => Effect.Effect<ArtifactManifest, PublishingCapabilityError>
}

export class Artifacter extends Context.Service<Artifacter, ArtifacterService>()('artifacter') {}
