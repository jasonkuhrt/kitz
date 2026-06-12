import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Array as A } from 'effect'
import * as Capability from '../models/capability.js'

export const id = 'npm'

export type NpmPublishCommandOptions = NpmRegistry.Argv.NpmPublishArgvOptions

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: NpmRegistry.Argv.NpmPackArgvOptions) =>
  Pkg.Manager.Command.fromParts('npm', NpmRegistry.Argv.npmPack(params))

export const buildPublishCommand = (params: NpmPublishCommandOptions) =>
  Pkg.Manager.Command.fromParts('npm', NpmRegistry.Argv.npmPublish(params))

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
