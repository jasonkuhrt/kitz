import { Sch } from '@kitz/sch'
import { Array as A, Option, Schema } from 'effect'
import * as Capability from './models/capability.js'

export const ConformanceScenarioOutcome = Schema.Literals(['supported', 'unsupported'])
export type ConformanceScenarioOutcome = typeof ConformanceScenarioOutcome.Type

export class ConformanceScenarioResult extends Sch.Class<ConformanceScenarioResult>()(
  'ConformanceScenarioResult',
  {
    providerId: Schema.String,
    capability: Capability.PublishCapability,
    scenarioId: Schema.String,
    result: ConformanceScenarioOutcome,
    evidence: Schema.Array(Schema.String),
    errorCode: Schema.optional(Schema.String),
  },
) {
  static scenarioIdFor = (capability: Capability.PublishCapability) => `capability:${capability}`

  static invalidCapabilityResult = (params: {
    readonly providerId: string
    readonly capability: Capability.PublishCapability
  }) =>
    ConformanceScenarioResult.make({
      providerId: params.providerId,
      capability: params.capability,
      scenarioId: ConformanceScenarioResult.scenarioIdFor(params.capability),
      result: 'unsupported',
      evidence: ['provider returned invalid capability result'],
      errorCode: 'release.conformance.invalid-capability-result',
    })

  static fromCapabilityResult = (params: {
    readonly providerId: string
    readonly capability: Capability.PublishCapability
    readonly observed: unknown
  }) => {
    const decoded = Capability.decodeResultOption(params.observed)
    if (Option.isNone(decoded)) {
      return ConformanceScenarioResult.invalidCapabilityResult(params)
    }

    const result = decoded.value
    return ConformanceScenarioResult.make({
      providerId: params.providerId,
      capability: params.capability,
      scenarioId: ConformanceScenarioResult.scenarioIdFor(params.capability),
      result: result.supportState,
      evidence: result.evidence,
      ...(Capability.Unsupported.is(result) ? { errorCode: result.conformanceErrorCode } : {}),
    })
  }

  get isSupported() {
    return this.result === 'supported'
  }
}

export interface ConformanceProvider {
  readonly id: string
  readonly owner?: 'production' | 'test-only'
  readonly capabilityResult: (
    capability: Capability.PublishCapability,
  ) => Capability.CapabilityResult
}

export class ConformanceReport extends Sch.Class<ConformanceReport>()('ConformanceReport', {
  schemaVersion: Schema.Literal(1),
  providerId: Schema.String,
  productionSelectable: Schema.Boolean,
  results: Schema.Array(ConformanceScenarioResult),
}) {
  static fromProvider = (provider: ConformanceProvider) =>
    ConformanceReport.make({
      schemaVersion: 1,
      providerId: provider.id,
      productionSelectable: provider.owner !== 'test-only',
      results: A.map(Capability.publishCapabilityValues, (capability) =>
        ConformanceScenarioResult.fromCapabilityResult({
          providerId: provider.id,
          capability,
          observed: provider.capabilityResult(capability),
        }),
      ),
    })
}

export const run = ConformanceReport.fromProvider
