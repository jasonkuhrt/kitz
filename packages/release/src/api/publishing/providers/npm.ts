import { Pkg } from '@kitz/pkg'
import { Array as A, HashSet } from 'effect'
import * as Capability from '../models/capability.js'

export const id = 'npm'

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

export const capabilities = HashSet.fromIterable(
  A.filter(
    Capability.publishCapabilityValues,
    (capability) =>
      Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id }).isSupported,
  ),
)

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: {
  readonly packDestination: string
  readonly dryRun?: boolean
}) =>
  Pkg.Manager.Command.fromParts('npm', [
    'pack',
    '--json',
    '--pack-destination',
    params.packDestination,
    ...(params.dryRun === true ? ['--dry-run'] : []),
  ])

export const buildPublishCommand = (params: NpmPublishCommandOptions) =>
  Pkg.Manager.Command.fromParts('npm', [
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
  ])

export const buildTrustListCommand = (params: {
  readonly packageName?: string
  readonly registry?: string
  readonly json?: boolean
}) =>
  Pkg.Manager.Command.fromParts('npm', [
    'trust',
    'list',
    ...(params.packageName !== undefined ? [params.packageName] : []),
    ...(params.registry !== undefined ? ['--registry', params.registry] : []),
    ...(params.json === true ? ['--json'] : []),
  ])

export const buildTrustGithubCommand = (params: {
  readonly packageName: string
  readonly repository: string
  readonly workflowFile: string
  readonly environment?: string
  readonly registry?: string
  readonly yes?: boolean
  readonly dryRun?: boolean
}) =>
  Pkg.Manager.Command.fromParts('npm', [
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
  ])

export const buildTrustGitlabCommand = (params: {
  readonly packageName: string
  readonly project: string
  readonly workflowFile: string
  readonly environment?: string
  readonly registry?: string
  readonly yes?: boolean
  readonly dryRun?: boolean
}) =>
  Pkg.Manager.Command.fromParts('npm', [
    'trust',
    'gitlab',
    params.packageName,
    '--project',
    params.project,
    '--file',
    params.workflowFile,
    ...(params.environment !== undefined ? ['--environment', params.environment] : []),
    ...(params.registry !== undefined ? ['--registry', params.registry] : []),
    ...(params.yes === true ? ['--yes'] : []),
    ...(params.dryRun === true ? ['--dry-run'] : []),
  ])

export const buildTrustCircleciCommand = (params: {
  readonly packageName: string
  readonly orgId: string
  readonly projectId: string
  readonly pipelineDefinitionId: string
  readonly vcsOrigin: string
  readonly contextIds?: readonly string[]
  readonly registry?: string
  readonly yes?: boolean
  readonly dryRun?: boolean
}) =>
  Pkg.Manager.Command.fromParts('npm', [
    'trust',
    'circleci',
    params.packageName,
    '--org-id',
    params.orgId,
    '--project-id',
    params.projectId,
    '--pipeline-definition-id',
    params.pipelineDefinitionId,
    '--vcs-origin',
    params.vcsOrigin,
    ...A.flatMap(params.contextIds ?? [], (contextId) => ['--context-id', contextId]),
    ...(params.registry !== undefined ? ['--registry', params.registry] : []),
    ...(params.yes === true ? ['--yes'] : []),
    ...(params.dryRun === true ? ['--dry-run'] : []),
  ])
