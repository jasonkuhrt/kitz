import { HashSet } from 'effect'
import type { PublishCapability } from '../models/capability.js'
import { unsupported, supported, type CapabilityResult } from '../models/capability.js'

export interface FakeProvider {
  readonly id: 'fake-registry'
  readonly owner: 'test-only'
  readonly supportedCapabilities: HashSet.HashSet<PublishCapability>
  readonly capabilityResult: (capability: PublishCapability) => CapabilityResult
}

export const make = (capabilities: Iterable<PublishCapability>): FakeProvider => {
  const supportedCapabilities = HashSet.fromIterable(capabilities)
  return {
    id: 'fake-registry',
    owner: 'test-only',
    supportedCapabilities,
    capabilityResult: (capability) =>
      HashSet.has(supportedCapabilities, capability)
        ? supported({
            capability,
            provider: 'fake-registry',
            evidence: [`fake fixture supports ${capability}`],
          })
        : unsupported({
            capability,
            provider: 'fake-registry',
            reason: 'not-supported-by-provider',
            evidence: [`fake fixture does not support ${capability}`],
            blockingPlanFields: [],
          }),
  }
}
