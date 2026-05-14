import type { PublishCapability } from '../models/capability.js'
import { HashSet } from 'effect'
import { capabilityResultForProvider, publishCapabilityValues } from '../models/capability.js'

export const id = 'npm' as const

export interface NpmPublishCommandOptions {
  readonly target: string
  readonly tag?: string
  readonly registry?: string
  readonly access?: 'public' | 'restricted'
  readonly otp?: string
  readonly provenance?: boolean
  readonly provenanceFile?: string
  readonly dryRun?: boolean
  readonly ignoreScripts?: boolean
}

export const capabilities: HashSet.HashSet<PublishCapability> = HashSet.fromIterable(
  publishCapabilityValues.filter(
    (capability) => capabilityResultForProvider({ capability, provider: id })._tag === 'Supported',
  ),
)

export const capabilityResult = (capability: PublishCapability) =>
  capabilityResultForProvider({ capability, provider: id })

export const buildPackCommand = (params: {
  readonly packDestination: string
  readonly dryRun?: boolean
}): readonly string[] => [
  'npm',
  'pack',
  '--json',
  '--pack-destination',
  params.packDestination,
  ...(params.dryRun === true ? ['--dry-run'] : []),
]

export const buildPublishCommand = (params: NpmPublishCommandOptions): readonly string[] => [
  'npm',
  'publish',
  params.target,
  '--access',
  params.access ?? 'public',
  ...((params.ignoreScripts ?? true) ? ['--ignore-scripts'] : []),
  ...(params.tag !== undefined ? ['--tag', params.tag] : []),
  ...(params.registry !== undefined ? ['--registry', params.registry] : []),
  ...(params.otp !== undefined ? ['--otp', params.otp] : []),
  ...(params.provenance === true ? ['--provenance'] : []),
  ...(params.provenanceFile !== undefined ? ['--provenance-file', params.provenanceFile] : []),
  ...(params.dryRun === true ? ['--dry-run'] : []),
]

export const buildTrustListCommand = (params: {
  readonly packageName?: string
  readonly registry?: string
  readonly json?: boolean
}): readonly string[] => [
  'npm',
  'trust',
  'list',
  ...(params.packageName !== undefined ? [params.packageName] : []),
  ...(params.registry !== undefined ? ['--registry', params.registry] : []),
  ...(params.json === true ? ['--json'] : []),
]

export const buildTrustGithubCommand = (params: {
  readonly packageName: string
  readonly repository: string
  readonly workflowFile: string
  readonly environment?: string
  readonly registry?: string
  readonly yes?: boolean
  readonly dryRun?: boolean
}): readonly string[] => [
  'npm',
  'trust',
  'github',
  params.packageName,
  '--repository',
  params.repository,
  '--file',
  params.workflowFile,
  ...(params.environment !== undefined ? ['--environment', params.environment] : []),
  ...(params.registry !== undefined ? ['--registry', params.registry] : []),
  ...(params.yes === true ? ['--yes'] : []),
  ...(params.dryRun === true ? ['--dry-run'] : []),
]
