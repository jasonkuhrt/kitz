import { Pkg } from '@kitz/pkg'
import { Array as A, HashSet } from 'effect'
import * as Capability from '../models/capability.js'

export const id = 'pnpm'

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

export interface PnpmPackCommandOptions {
  readonly packDestination: string
  readonly dryRun?: boolean
}

export const capabilities = HashSet.fromIterable(
  A.filter(
    Capability.publishCapabilityValues,
    (capability) =>
      Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id }).isSupported,
  ),
)

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: PnpmPackCommandOptions) =>
  Pkg.Manager.Command.fromParts('pnpm', [
    'pack',
    '--json',
    '--pack-destination',
    params.packDestination,
    ...(params.dryRun === true ? ['--dry-run'] : []),
  ])

export const buildPublishCommand = (params: PnpmPublishCommandOptions) =>
  Pkg.Manager.Command.fromParts('pnpm', [
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
  ])
