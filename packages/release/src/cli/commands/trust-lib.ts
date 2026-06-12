/**
 * @module cli/commands/trust-lib
 *
 * Decision logic behind `release trust`: mapping CLI flag values onto the
 * npm trusted-publisher provisioning command lines. The command file stays
 * thin wiring; the flag→argv projection lives here where it is unit-testable.
 */
import * as Publisher from '../../api/publishing/__.js'

export interface TrustListParams {
  readonly packageName: string | undefined
  readonly registry: string | undefined
  readonly json: boolean
}

export const renderTrustListCommand = (params: TrustListParams): string =>
  Publisher.Providers.Npm.buildTrustListCommand({
    ...(params.packageName === undefined ? {} : { packageName: params.packageName }),
    ...(params.registry === undefined ? {} : { registry: params.registry }),
    json: params.json,
  }).argv.join(' ')

export interface TrustSetupCommonParams {
  readonly packageName: string
  readonly environment: string | undefined
  readonly registry: string | undefined
  readonly yes: boolean
  readonly dryRun: boolean
}

const commonSetupFields = (params: TrustSetupCommonParams) => ({
  packageName: params.packageName,
  ...(params.environment === undefined ? {} : { environment: params.environment }),
  ...(params.registry === undefined ? {} : { registry: params.registry }),
  yes: params.yes,
  dryRun: params.dryRun,
})

export const renderTrustGithubCommand = (
  params: TrustSetupCommonParams & {
    readonly repository: string
    readonly workflowFile: string
  },
): string =>
  Publisher.Providers.Npm.buildTrustGithubCommand({
    ...commonSetupFields(params),
    repository: params.repository,
    workflowFile: params.workflowFile,
  }).argv.join(' ')

export const renderTrustGitlabCommand = (
  params: TrustSetupCommonParams & {
    readonly project: string
    readonly workflowFile: string
  },
): string =>
  Publisher.Providers.Npm.buildTrustGitlabCommand({
    ...commonSetupFields(params),
    project: params.project,
    workflowFile: params.workflowFile,
  }).argv.join(' ')

export const renderTrustCircleciCommand = (
  params: TrustSetupCommonParams & {
    readonly orgId: string
    readonly projectId: string
    readonly pipelineDefinitionId: string
    readonly vcsOrigin: string
  },
): string =>
  Publisher.Providers.Npm.buildTrustCircleciCommand({
    ...commonSetupFields(params),
    orgId: params.orgId,
    projectId: params.projectId,
    pipelineDefinitionId: params.pipelineDefinitionId,
    vcsOrigin: params.vcsOrigin,
  }).argv.join(' ')
