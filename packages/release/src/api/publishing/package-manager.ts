import { Pkg } from '@kitz/pkg'
import { Context, Effect, HashSet } from 'effect'
import type { PublishingCapabilityError } from './errors.js'
import type { PublishCapability } from './models/capability.js'
import { PublishDriverId } from './models/driver-id.js'
import type {
  DriverVersionProof,
  PackedArtifact,
  PublishDryRunProof,
  PublishReceipt,
  SubcommandProof,
} from './models/proof.js'
import type { PackRequest, PublishRequest, SubcommandProofRequest } from './requests.js'

export const PackageManagerAgent = PublishDriverId
export type PackageManagerAgent = typeof PackageManagerAgent.Type
export const PackageManagerCommand = Pkg.Manager.Command
export type PackageManagerCommand = Pkg.Manager.Command

export const agentFromProjectManager = (
  manager: Pkg.Manager.PackageManager,
): PackageManagerAgent => {
  switch (manager) {
    case 'bun':
    case 'npm':
    case 'pnpm':
      return manager
    case 'unknown':
    case 'yarn':
      return 'npm'
  }
}

export interface PackageManagerService {
  readonly id: PackageManagerAgent
  readonly capabilities: HashSet.HashSet<PublishCapability>
  readonly version: Effect.Effect<DriverVersionProof, PublishingCapabilityError>
  readonly proveSubcommands: (
    request: SubcommandProofRequest,
  ) => Effect.Effect<SubcommandProof, PublishingCapabilityError>
  readonly pack: (request: PackRequest) => Effect.Effect<PackedArtifact, PublishingCapabilityError>
  readonly publishDryRun: (
    request: PublishRequest,
  ) => Effect.Effect<PublishDryRunProof, PublishingCapabilityError>
  readonly publish: (
    request: PublishRequest,
  ) => Effect.Effect<PublishReceipt, PublishingCapabilityError>
}

export class PackageManager extends Context.Service<PackageManager, PackageManagerService>()(
  'packagemanager',
) {}
