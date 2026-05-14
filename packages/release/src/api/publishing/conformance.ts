import { Schema } from 'effect'
import {
  CapabilityResult,
  publishCapabilityValues,
  type PublishCapability,
} from './models/capability.js'

export interface ConformanceScenarioResult {
  readonly providerId: string
  readonly capability: PublishCapability
  readonly scenarioId: string
  readonly result: 'supported' | 'unsupported'
  readonly evidence: readonly string[]
  readonly errorCode?: string
}

export interface ConformanceProvider {
  readonly id: string
  readonly owner?: 'production' | 'test-only'
  readonly capabilityResult: (capability: PublishCapability) => CapabilityResult
}

export interface ConformanceReport {
  readonly schemaVersion: 1
  readonly providerId: string
  readonly productionSelectable: boolean
  readonly results: readonly ConformanceScenarioResult[]
}

export const run = (provider: ConformanceProvider): ConformanceReport => {
  const results = publishCapabilityValues.map((capability): ConformanceScenarioResult => {
    const observed = provider.capabilityResult(capability)
    if (!Schema.is(CapabilityResult)(observed)) {
      return {
        providerId: provider.id,
        capability,
        scenarioId: `capability:${capability}`,
        result: 'unsupported',
        evidence: ['provider returned invalid capability result'],
        errorCode: 'release.conformance.invalid-capability-result',
      }
    }

    return {
      providerId: provider.id,
      capability,
      scenarioId: `capability:${capability}`,
      result: observed._tag === 'Supported' ? 'supported' : 'unsupported',
      evidence: observed.evidence,
      ...(observed._tag === 'Unsupported'
        ? { errorCode: `release.conformance.unsupported.${capability.replace(':', '.')}` }
        : {}),
    }
  })

  return {
    schemaVersion: 1,
    providerId: provider.id,
    productionSelectable: provider.owner !== 'test-only',
    results,
  }
}
