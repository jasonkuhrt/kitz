/**
 * @module cli/commands/trust
 *
 * Render npm trusted-publisher provisioning commands (`release trust list`,
 * `release trust setup <provider>`) for npm OIDC trusted publishing.
 *
 * Provider-specific requirements are expressed as framework-required flags on
 * provider subcommands (`trust setup github|gitlab|circleci`) — the framework
 * owns requiredness validation. Flag→argv projection lives in `trust-lib.ts`.
 */
import { Console, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import {
  renderTrustCircleciCommand,
  renderTrustGithubCommand,
  renderTrustGitlabCommand,
  renderTrustListCommand,
} from './trust-lib.js'

const trustList = Command.make(
  'list',
  {
    pkg: Flag.string('pkg').pipe(Flag.withDescription('Package name'), Flag.optional),
    registry: Flag.string('registry').pipe(Flag.withDescription('Registry URL'), Flag.optional),
    json: Flag.boolean('json').pipe(
      Flag.withDescription('Emit the npm command with JSON output'),
      Flag.withDefault(false),
    ),
  },
  ({ pkg, registry, json }) =>
    Console.log(
      renderTrustListCommand({
        packageName: Option.getOrUndefined(pkg),
        registry: Option.getOrUndefined(registry),
        json,
      }),
    ),
).pipe(Command.withDescription('List trusted-publisher configuration for a package'))

// Flags shared by every `trust setup <provider>` subcommand. `--pkg` is
// framework-required; the rest are optional refinements.
const setupCommonFlags = {
  pkg: Flag.string('pkg').pipe(Flag.withDescription('Package name')),
  env: Flag.string('env').pipe(Flag.withDescription('Deployment environment'), Flag.optional),
  registry: Flag.string('registry').pipe(Flag.withDescription('Registry URL'), Flag.optional),
  yes: Flag.boolean('yes').pipe(
    Flag.withDescription('Skip confirmation prompts'),
    Flag.withDefault(false),
  ),
  dryRun: Flag.boolean('dry-run').pipe(
    Flag.withDescription('Emit the command without applying it'),
    Flag.withDefault(false),
  ),
}

const commonSetupParams = (flags: {
  readonly pkg: string
  readonly env: Option.Option<string>
  readonly registry: Option.Option<string>
  readonly yes: boolean
  readonly dryRun: boolean
}) => ({
  packageName: flags.pkg,
  environment: Option.getOrUndefined(flags.env),
  registry: Option.getOrUndefined(flags.registry),
  yes: flags.yes,
  dryRun: flags.dryRun,
})

const trustSetupGithub = Command.make(
  'github',
  {
    ...setupCommonFlags,
    workflow: Flag.string('workflow').pipe(Flag.withDescription('GitHub workflow file')),
    repo: Flag.string('repo').pipe(Flag.withDescription('GitHub repository (owner/name)')),
  },
  (flags) =>
    Console.log(
      renderTrustGithubCommand({
        ...commonSetupParams(flags),
        repository: flags.repo,
        workflowFile: flags.workflow,
      }),
    ),
).pipe(Command.withDescription('Render the GitHub Actions trusted-publisher provisioning command'))

const trustSetupGitlab = Command.make(
  'gitlab',
  {
    ...setupCommonFlags,
    file: Flag.string('file').pipe(Flag.withDescription('GitLab workflow file')),
    project: Flag.string('project').pipe(
      Flag.withDescription('GitLab project (namespace/project)'),
    ),
  },
  (flags) =>
    Console.log(
      renderTrustGitlabCommand({
        ...commonSetupParams(flags),
        project: flags.project,
        workflowFile: flags.file,
      }),
    ),
).pipe(Command.withDescription('Render the GitLab CI trusted-publisher provisioning command'))

const trustSetupCircleci = Command.make(
  'circleci',
  {
    ...setupCommonFlags,
    orgId: Flag.string('org-id').pipe(Flag.withDescription('CircleCI org id')),
    projectId: Flag.string('project-id').pipe(Flag.withDescription('CircleCI project id')),
    pipelineDefinitionId: Flag.string('pipeline-definition-id').pipe(
      Flag.withDescription('CircleCI pipeline definition id'),
    ),
    vcsOrigin: Flag.string('vcs-origin').pipe(Flag.withDescription('CircleCI VCS origin')),
  },
  (flags) =>
    Console.log(
      renderTrustCircleciCommand({
        ...commonSetupParams(flags),
        orgId: flags.orgId,
        projectId: flags.projectId,
        pipelineDefinitionId: flags.pipelineDefinitionId,
        vcsOrigin: flags.vcsOrigin,
      }),
    ),
).pipe(Command.withDescription('Render the CircleCI trusted-publisher provisioning command'))

const trustSetup = Command.make('setup').pipe(
  Command.withDescription('Render the npm trusted-publisher provisioning command for a provider'),
  Command.withSubcommands([trustSetupGithub, trustSetupGitlab, trustSetupCircleci]),
)

export const trust = Command.make('trust').pipe(
  Command.withDescription('Manage npm trusted-publisher (OIDC) provisioning commands'),
  Command.withSubcommands([trustList, trustSetup]),
)
