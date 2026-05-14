import type { Effect, Option } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type {
  AccessProof,
  DistTagProof,
  RegistryTarballObservation,
  VersionProof,
} from './results.js'
import type {
  AccessQuery,
  BatchAccessQuery,
  BatchDistTagQuery,
  BatchVersionQuery,
  DistTagQuery,
  VersionQuery,
} from './requests.js'

export interface RegistryClient {
  readonly viewPackageVersion: (
    request: VersionQuery,
  ) => Effect.Effect<Option.Option<VersionProof>, PublishingCapabilityError>
  readonly viewPackageVersions: (
    request: BatchVersionQuery,
  ) => Effect.Effect<ReadonlyArray<VersionProof>, PublishingCapabilityError>
  readonly viewDistTags: (
    request: DistTagQuery,
  ) => Effect.Effect<DistTagProof, PublishingCapabilityError>
  readonly viewManyDistTags: (
    request: BatchDistTagQuery,
  ) => Effect.Effect<ReadonlyArray<DistTagProof>, PublishingCapabilityError>
  readonly access: (request: AccessQuery) => Effect.Effect<AccessProof, PublishingCapabilityError>
  readonly accessMany: (
    request: BatchAccessQuery,
  ) => Effect.Effect<ReadonlyArray<AccessProof>, PublishingCapabilityError>
  readonly tarballMetadata: (
    request: VersionQuery,
  ) => Effect.Effect<RegistryTarballObservation, PublishingCapabilityError>
}
