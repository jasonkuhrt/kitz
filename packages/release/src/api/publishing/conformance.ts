import { Array as A, Option, Schema } from 'effect'
import * as Capability from './models/capability.js'

export const ConformanceScenarioOutcome = Schema.Literals(['supported', 'unsupported'])
export type ConformanceScenarioOutcome = typeof ConformanceScenarioOutcome.Type

export class ConformanceScenarioResult extends Schema.Class<ConformanceScenarioResult>(
  'ConformanceScenarioResult',
)({
  providerId: Schema.String,
  capability: Capability.PublishCapability,
  scenarioId: Schema.String,
  result: ConformanceScenarioOutcome,
  evidence: Schema.Array(Schema.String),
  errorCode: Schema.optional(Schema.String),
}) {
  static is = Schema.is(ConformanceScenarioResult)
  static decode = Schema.decodeUnknownEffect(ConformanceScenarioResult)
  static decodeSync = Schema.decodeUnknownSync(ConformanceScenarioResult)
  static encode = Schema.encodeUnknownEffect(ConformanceScenarioResult)
  static encodeSync = Schema.encodeUnknownSync(ConformanceScenarioResult)
  static equivalence = Schema.toEquivalence(ConformanceScenarioResult)
  static ordered = false as const

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

export class ConformanceReport extends Schema.Class<ConformanceReport>('ConformanceReport')({
  schemaVersion: Schema.Literal(1),
  providerId: Schema.String,
  productionSelectable: Schema.Boolean,
  results: Schema.Array(ConformanceScenarioResult),
}) {
  static is = Schema.is(ConformanceReport)
  static decode = Schema.decodeUnknownEffect(ConformanceReport)
  static decodeSync = Schema.decodeUnknownSync(ConformanceReport)
  static encode = Schema.encodeUnknownEffect(ConformanceReport)
  static encodeSync = Schema.encodeUnknownSync(ConformanceReport)
  static equivalence = Schema.toEquivalence(ConformanceReport)
  static ordered = false as const

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
