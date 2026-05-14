import type { PublishCapability } from '../models/capability.js'
import { HashSet } from 'effect'
import { capabilityResultForProvider, publishCapabilityValues } from '../models/capability.js'

export const id = 'bun' as const

export interface BunPublishCommandOptions {
  readonly target?: string
  readonly tag?: string
  readonly registry?: string
  readonly access?: 'public' | 'restricted'
  readonly otp?: string
  readonly authType?: 'web' | 'legacy'
  readonly dryRun?: boolean
  readonly tolerateRepublish?: boolean
}

export const capabilities: HashSet.HashSet<PublishCapability> = HashSet.fromIterable(
  publishCapabilityValues.filter(
    (capability) => capabilityResultForProvider({ capability, provider: id })._tag === 'Supported',
  ),
)

export const capabilityResult = (capability: PublishCapability) =>
  capabilityResultForProvider({ capability, provider: id })

export const buildPackCommand = (
  params: { readonly destination?: string } = {},
): readonly string[] => [
  'bun',
  'pm',
  'pack',
  ...(params.destination !== undefined ? ['--destination', params.destination] : []),
]

export const buildPublishCommand = (params: BunPublishCommandOptions): readonly string[] => [
  'bun',
  'publish',
  ...(params.target !== undefined ? [params.target] : []),
  ...(params.tag !== undefined ? ['--tag', params.tag] : []),
  ...(params.registry !== undefined ? ['--registry', params.registry] : []),
  ...(params.access !== undefined ? ['--access', params.access] : []),
  ...(params.otp !== undefined ? ['--otp', params.otp] : []),
  ...(params.authType !== undefined ? ['--auth-type', params.authType] : []),
  ...(params.dryRun === true ? ['--dry-run'] : []),
  ...(params.tolerateRepublish === true ? ['--tolerate-republish'] : []),
]
