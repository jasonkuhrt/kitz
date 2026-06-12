import { Sch } from '@kitz/sch'
import { Array as A, HashMap, Option, Schema } from 'effect'
import { PublishDriverId, publishDriverIdValues } from './driver-id.js'

export const publishCapabilityValues = [
  'tool:version-proof',
  'tool:subcommand-proof',
  'tool:flag-proof',
  'tool:invocation-context-proof',
  'pack:tarball',
  'pack:manifest-json',
  'pack:packlist',
  'pack:dry-run',
  'publish:tarball',
  'publish:folder',
  'publish:dry-run',
  'publish:tag',
  'publish:registry',
  'publish:access',
  'publish:otp',
  'publish:provenance-flag',
  'publish:provenance-file',
  'publish:trusted-oidc',
  'publish:ignore-scripts',
  'publish:tolerate-republish',
  'publish:summary-real',
  'registry:view-version',
  'registry:view-dist-tags',
  'registry:view-access',
  'registry:view-tarball-metadata',
  'registry:download-tarball',
  'credential:whoami',
  'credential:otp',
  'trust:list',
  'trust:setup-github',
  'trust:setup-gitlab',
  'trust:setup-circleci',
] as const

export const PublishCapability = Schema.Literals(publishCapabilityValues)
export type PublishCapability = typeof PublishCapability.Type

export const UnsupportedCapabilityReason = Schema.Literals([
  'not-documented',
  'binary-missing',
  'subcommand-missing',
  'flag-missing',
  'not-supported-by-provider',
])
export type UnsupportedCapabilityReason = typeof UnsupportedCapabilityReason.Type

export class Supported extends Sch.TaggedClass<Supported>()('CapabilityResultSupported', {
  capability: PublishCapability,
  provider: Schema.String,
  evidence: Schema.Array(Schema.String),
}) {
  static from = (params: {
    readonly capability: PublishCapability
    readonly provider: string
    readonly evidence: readonly string[]
  }) =>
    Supported.make({
      capability: params.capability,
      provider: params.provider,
      evidence: [...params.evidence],
    })

  get isSupported() {
    return true as const
  }

  get supportState() {
    return 'supported' as const
  }
}

export class Unsupported extends Sch.TaggedClass<Unsupported>()('CapabilityResultUnsupported', {
  capability: PublishCapability,
  provider: Schema.String,
  reason: UnsupportedCapabilityReason,
  evidence: Schema.Array(Schema.String),
  blockingPlanFields: Schema.Array(Schema.String),
}) {
  static from = (params: {
    readonly capability: PublishCapability
    readonly provider: string
    readonly reason: UnsupportedCapabilityReason
    readonly evidence: readonly string[]
    readonly blockingPlanFields?: readonly string[]
  }) =>
    Unsupported.make({
      capability: params.capability,
      provider: params.provider,
      reason: params.reason,
      evidence: [...params.evidence],
      blockingPlanFields: [...(params.blockingPlanFields ?? [])],
    })

  get conformanceErrorCode() {
    return `release.conformance.unsupported.${this.capability.replace(':', '.')}`
  }

  get isSupported() {
    return false as const
  }

  get supportState() {
    return 'unsupported' as const
  }
}

export type CapabilityResult = Supported | Unsupported
export const CapabilityResult = Schema.Union([Supported, Unsupported])
export const decodeResultOption = Schema.decodeUnknownOption(CapabilityResult)
export const isResult = Schema.is(CapabilityResult)

export const CapabilityOwner = Schema.Literals(['packagemanager', 'packageregistry', 'credentials'])
export type CapabilityOwner = typeof CapabilityOwner.Type

export const CapabilitySupportState = Schema.Literals(['supported', 'unsupported'])
export type CapabilitySupportState = typeof CapabilitySupportState.Type

export type CapabilityProviderId = PublishDriverId
const capabilityOwnerByCapability = {
  'tool:version-proof': 'packagemanager',
  'tool:subcommand-proof': 'packagemanager',
  'tool:flag-proof': 'packagemanager',
  'tool:invocation-context-proof': 'packagemanager',
  'pack:tarball': 'packagemanager',
  'pack:manifest-json': 'packagemanager',
  'pack:packlist': 'packagemanager',
  'pack:dry-run': 'packagemanager',
  'publish:tarball': 'packagemanager',
  'publish:folder': 'packagemanager',
  'publish:dry-run': 'packagemanager',
  'publish:tag': 'packagemanager',
  'publish:registry': 'packagemanager',
  'publish:access': 'packagemanager',
  'publish:otp': 'packagemanager',
  'publish:provenance-flag': 'packagemanager',
  'publish:provenance-file': 'packagemanager',
  'publish:trusted-oidc': 'packagemanager',
  'publish:ignore-scripts': 'packagemanager',
  'publish:tolerate-republish': 'packagemanager',
  'publish:summary-real': 'packagemanager',
  'registry:view-version': 'packageregistry',
  'registry:view-dist-tags': 'packageregistry',
  'registry:view-access': 'packageregistry',
  'registry:view-tarball-metadata': 'packageregistry',
  'registry:download-tarball': 'packageregistry',
  'credential:whoami': 'credentials',
  'credential:otp': 'credentials',
  'trust:list': 'credentials',
  'trust:setup-github': 'credentials',
  'trust:setup-gitlab': 'credentials',
  'trust:setup-circleci': 'credentials',
} as const satisfies Record<PublishCapability, CapabilityOwner>

export class CapabilityMatrixRow extends Sch.Class<CapabilityMatrixRow>()('CapabilityMatrixRow', {
  capability: PublishCapability,
  owner: CapabilityOwner,
  providers: Schema.Record(PublishDriverId, CapabilitySupportState),
  evidence: Schema.Array(Schema.String),
  conformance: Schema.Array(Schema.String),
}) {
  static fromCapability = (capability: PublishCapability) =>
    CapabilityMatrixRow.make({
      capability,
      owner: CapabilityMatrixRow.ownerFor(capability),
      providers: CapabilityMatrixRow.supportFor(capability),
      evidence: [`${capability} provider contract`],
      conformance: [`publisher/drivers/conformance.test.ts:${capability}`],
    })

  static ownerFor = (capability: PublishCapability): CapabilityOwner =>
    capabilityOwnerByCapability[capability]

  static supportFor = (
    capability: PublishCapability,
  ): Readonly<Record<CapabilityProviderId, CapabilitySupportState>> => {
    if (capability.startsWith('trust:')) {
      return { npm: 'supported', pnpm: 'unsupported', bun: 'unsupported' }
    }
    if (capability === 'publish:ignore-scripts') {
      return { npm: 'supported', pnpm: 'supported', bun: 'unsupported' }
    }
    if (capability === 'publish:summary-real') {
      return { npm: 'supported', pnpm: 'supported', bun: 'unsupported' }
    }
    if (capability === 'publish:tolerate-republish') {
      return { npm: 'unsupported', pnpm: 'unsupported', bun: 'supported' }
    }
    if (capability === 'publish:trusted-oidc') {
      return { npm: 'supported', pnpm: 'supported', bun: 'unsupported' }
    }
    if (capability === 'publish:provenance-file') {
      return { npm: 'unsupported', pnpm: 'unsupported', bun: 'unsupported' }
    }
    return { npm: 'supported', pnpm: 'supported', bun: 'supported' }
  }

  static resultForProvider = (params: {
    readonly capability: PublishCapability
    readonly provider: CapabilityProviderId
  }) => {
    const row = Option.getOrUndefined(HashMap.get(capabilityMatrixByCapability, params.capability))
    if (row === undefined) {
      return Unsupported.from({
        capability: params.capability,
        provider: params.provider,
        reason: 'not-supported-by-provider',
        evidence: [`${params.capability} has no generated matrix row`],
        blockingPlanFields: [],
      })
    }
    return row.resultForProvider(params.provider)
  }

  get supportedProviderIds() {
    return A.filter(publishDriverIdValues, (provider) => this.providers[provider] === 'supported')
  }

  resultForProvider(provider: CapabilityProviderId) {
    if (this.providers[provider] === 'supported') {
      return Supported.from({
        capability: this.capability,
        provider,
        evidence: this.evidence,
      })
    }

    return Unsupported.from({
      capability: this.capability,
      provider,
      reason: 'not-supported-by-provider',
      evidence: this.evidence,
      blockingPlanFields: [],
    })
  }
}

export const capabilityMatrix = A.map(publishCapabilityValues, CapabilityMatrixRow.fromCapability)

export const capabilityMatrixByCapability = HashMap.fromIterable(
  A.map(capabilityMatrix, (row) => [row.capability, row] as const),
)
