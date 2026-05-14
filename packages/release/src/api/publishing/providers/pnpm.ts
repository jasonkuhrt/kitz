import type { PublishCapability } from '../models/capability.js'
import { HashSet } from 'effect'
import { capabilityResultForProvider, publishCapabilityValues } from '../models/capability.js'

export const id = 'pnpm' as const

export interface PnpmPublishCommandOptions {
  readonly target?: string
  readonly tag?: string
  readonly registry?: string
  readonly access?: 'public' | 'restricted'
  readonly otp?: string
  readonly provenance?: boolean
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly reportSummary?: boolean
  readonly noGitChecks?: boolean
}

export const capabilities: HashSet.HashSet<PublishCapability> = HashSet.fromIterable(
  publishCapabilityValues.filter(
    (capability) => capabilityResultForProvider({ capability, provider: id })._tag === 'Supported',
  ),
)

export const capabilityResult = (capability: PublishCapability) =>
  capabilityResultForProvider({ capability, provider: id })

export const buildPublishCommand = (params: PnpmPublishCommandOptions): readonly string[] => [
  'pnpm',
  'publish',
  ...(params.target !== undefined ? [params.target] : []),
  ...(params.tag !== undefined ? ['--tag', params.tag] : []),
  ...(params.registry !== undefined ? ['--registry', params.registry] : []),
  ...(params.access !== undefined ? ['--access', params.access] : []),
  ...(params.otp !== undefined ? ['--otp', params.otp] : []),
  ...(params.provenance === true ? ['--provenance'] : []),
  ...(params.dryRun === true ? ['--dry-run'] : []),
  ...(params.json === true ? ['--json'] : []),
  ...(params.reportSummary === true ? ['--report-summary'] : []),
  ...(params.noGitChecks === true ? ['--no-git-checks'] : []),
]
