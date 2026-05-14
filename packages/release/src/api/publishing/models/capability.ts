import { HashMap, Option, Schema } from 'effect'

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

export const CapabilityResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal('Supported'),
    capability: PublishCapability,
    provider: Schema.String,
    evidence: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Unsupported'),
    capability: PublishCapability,
    provider: Schema.String,
    reason: UnsupportedCapabilityReason,
    evidence: Schema.Array(Schema.String),
    blockingPlanFields: Schema.Array(Schema.String),
  }),
])
export type CapabilityResult = typeof CapabilityResult.Type

export const CapabilityOwner = Schema.Literals([
  'tool',
  'pack-driver',
  'publish-invoker',
  'registry-client',
  'credential-provider',
  'trusted-publisher-admin',
])
export type CapabilityOwner = typeof CapabilityOwner.Type

export class CapabilityMatrixRow extends Schema.Class<CapabilityMatrixRow>('CapabilityMatrixRow')({
  capability: PublishCapability,
  owner: CapabilityOwner,
  providers: Schema.Record(Schema.String, Schema.Literals(['supported', 'unsupported'])),
  evidence: Schema.Array(Schema.String),
  conformance: Schema.Array(Schema.String),
}) {
  static is = Schema.is(CapabilityMatrixRow)
  static decode = Schema.decodeUnknownEffect(CapabilityMatrixRow)
  static decodeSync = Schema.decodeUnknownSync(CapabilityMatrixRow)
  static encode = Schema.encodeUnknownEffect(CapabilityMatrixRow)
  static encodeSync = Schema.encodeUnknownSync(CapabilityMatrixRow)
  static equivalence = Schema.toEquivalence(CapabilityMatrixRow)
  static ordered = false as const
  static make = this.makeUnsafe
}

const ownerFor = (capability: PublishCapability): CapabilityOwner => {
  if (capability.startsWith('tool:')) return 'tool'
  if (capability.startsWith('pack:')) return 'pack-driver'
  if (capability.startsWith('publish:')) return 'publish-invoker'
  if (capability.startsWith('registry:')) return 'registry-client'
  if (capability.startsWith('credential:')) return 'credential-provider'
  return 'trusted-publisher-admin'
}

const supportFor = (
  capability: PublishCapability,
): Readonly<Record<'npm' | 'pnpm' | 'bun', 'supported' | 'unsupported'>> => {
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

export const capabilityMatrix = publishCapabilityValues.map((capability) =>
  CapabilityMatrixRow.make({
    capability,
    owner: ownerFor(capability),
    providers: supportFor(capability),
    evidence: [`${capability} provider contract`],
    conformance: [`publisher/drivers/conformance.test.ts:${capability}`],
  }),
)

export const capabilityMatrixByCapability = HashMap.fromIterable(
  capabilityMatrix.map((row) => [row.capability, row] as const),
)

export type CapabilityProviderId = 'npm' | 'pnpm' | 'bun'

export const supported = (params: {
  readonly capability: PublishCapability
  readonly provider: string
  readonly evidence: readonly string[]
}): CapabilityResult => ({
  _tag: 'Supported',
  capability: params.capability,
  provider: params.provider,
  evidence: [...params.evidence],
})

export const unsupported = (params: {
  readonly capability: PublishCapability
  readonly provider: string
  readonly reason: UnsupportedCapabilityReason
  readonly evidence: readonly string[]
  readonly blockingPlanFields?: readonly string[]
}): CapabilityResult => ({
  _tag: 'Unsupported',
  capability: params.capability,
  provider: params.provider,
  reason: params.reason,
  evidence: [...params.evidence],
  blockingPlanFields: [...(params.blockingPlanFields ?? [])],
})

export const capabilityResultForProvider = (params: {
  readonly capability: PublishCapability
  readonly provider: CapabilityProviderId
}): CapabilityResult => {
  const row = Option.getOrUndefined(HashMap.get(capabilityMatrixByCapability, params.capability))
  const state = row?.providers[params.provider] ?? 'unsupported'
  const evidence = row?.evidence ?? [`${params.capability} has no generated matrix row`]

  if (state === 'supported') {
    return supported({
      capability: params.capability,
      provider: params.provider,
      evidence,
    })
  }

  return unsupported({
    capability: params.capability,
    provider: params.provider,
    reason: 'not-supported-by-provider',
    evidence,
    blockingPlanFields: [],
  })
}
