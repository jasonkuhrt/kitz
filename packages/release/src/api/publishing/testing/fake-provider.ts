import { HashSet } from 'effect'
import * as Capability from '../models/capability.js'

export interface FakeProvider {
  readonly id: 'fake-registry'
  readonly owner: 'test-only'
  readonly supportedCapabilities: HashSet.HashSet<Capability.PublishCapability>
  readonly capabilityResult: (
    capability: Capability.PublishCapability,
  ) => Capability.CapabilityResult
}

export const make = (capabilities: Iterable<Capability.PublishCapability>): FakeProvider => {
  const supportedCapabilities = HashSet.fromIterable(capabilities)
  return {
    id: 'fake-registry',
    owner: 'test-only',
    supportedCapabilities,
    capabilityResult: (capability) =>
      HashSet.has(supportedCapabilities, capability)
        ? Capability.Supported.from({
            capability,
            provider: 'fake-registry',
            evidence: [`fake fixture supports ${capability}`],
          })
        : Capability.Unsupported.from({
            capability,
            provider: 'fake-registry',
            reason: 'not-supported-by-provider',
            evidence: [`fake fixture does not support ${capability}`],
            blockingPlanFields: [],
          }),
  }
}
