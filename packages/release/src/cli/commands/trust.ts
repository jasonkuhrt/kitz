/**
 * @module cli/commands/trust
 *
 * Render npm trusted-publisher provisioning commands (`release trust list`,
 * `release trust setup`, `release trust verify`) for npm OIDC trusted publishing.
 */
import { Env } from '@kitz/env'
import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'

const get = (option: Option.Option<string>): string | undefined =>
  Option.isSome(option) ? option.value : undefined

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
    Effect.gen(function* () {
      const packageName = get(pkg)
      const registryValue = get(registry)
      yield* Console.log(
        Api.Publisher.Providers.Npm.buildTrustListCommand({
          ...(packageName === undefined ? {} : { packageName }),
          ...(registryValue === undefined ? {} : { registry: registryValue }),
          json,
        }).argv.join(' '),
      )
    }),
).pipe(Command.withDescription('List trusted-publisher configuration for a package'))

const trustVerify = Command.make(
  'verify',
  {
    from: Flag.string('from').pipe(Flag.withDescription('Plan file to verify'), Flag.optional),
  },
  ({ from }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const fromValue = get(from)
      if (fromValue === undefined) {
        yield* Console.error('Missing required --from <plan>.')
        return env.exit(1)
      }
      yield* Console.log(`Trusted-publisher verification is plan-bound: ${fromValue}`)
    }),
).pipe(Command.withDescription('Verify trusted-publisher configuration for a plan'))

const trustSetup = Command.make(
  'setup',
  {
    provider: Flag.string('provider').pipe(
      Flag.withDescription('Trusted-publisher provider (github, gitlab, circleci)'),
      Flag.optional,
    ),
    pkg: Flag.string('pkg').pipe(Flag.withDescription('Package name'), Flag.optional),
    workflow: Flag.string('workflow').pipe(
      Flag.withDescription('GitHub workflow file'),
      Flag.optional,
    ),
    repo: Flag.string('repo').pipe(
      Flag.withDescription('GitHub repository (owner/name)'),
      Flag.optional,
    ),
    file: Flag.string('file').pipe(Flag.withDescription('GitLab workflow file'), Flag.optional),
    project: Flag.string('project').pipe(
      Flag.withDescription('GitLab project (namespace/project)'),
      Flag.optional,
    ),
    orgId: Flag.string('org-id').pipe(Flag.withDescription('CircleCI org id'), Flag.optional),
    projectId: Flag.string('project-id').pipe(
      Flag.withDescription('CircleCI project id'),
      Flag.optional,
    ),
    pipelineDefinitionId: Flag.string('pipeline-definition-id').pipe(
      Flag.withDescription('CircleCI pipeline definition id'),
      Flag.optional,
    ),
    vcsOrigin: Flag.string('vcs-origin').pipe(
      Flag.withDescription('CircleCI VCS origin'),
      Flag.optional,
    ),
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
  },
  (flags) =>
    Effect.gen(function* () {
      const env = yield* Env.Env

      const provider = get(flags.provider)
      const packageName = get(flags.pkg)
      if (provider === undefined || packageName === undefined) {
        yield* Console.error('Missing required --provider and --pkg.')
        return env.exit(1)
      }

      if (provider === 'github') {
        const workflow = get(flags.workflow)
        const repository = get(flags.repo)
        if (workflow === undefined || repository === undefined) {
          yield* Console.error('GitHub trusted setup requires --workflow and --repo.')
          return env.exit(1)
        }
        const environment = get(flags.env)
        const registry = get(flags.registry)
        yield* Console.log(
          Api.Publisher.Providers.Npm.buildTrustGithubCommand({
            packageName,
            repository,
            workflowFile: workflow,
            ...(environment === undefined ? {} : { environment }),
            ...(registry === undefined ? {} : { registry }),
            yes: flags.yes,
            dryRun: flags.dryRun,
          }).argv.join(' '),
        )
        return
      }

      if (provider === 'gitlab') {
        const workflow = get(flags.file)
        const project = get(flags.project)
        if (workflow === undefined || project === undefined) {
          yield* Console.error('GitLab trusted setup requires --file and --project.')
          return env.exit(1)
        }
        const environment = get(flags.env)
        const registry = get(flags.registry)
        yield* Console.log(
          Api.Publisher.Providers.Npm.buildTrustGitlabCommand({
            packageName,
            project,
            workflowFile: workflow,
            ...(environment === undefined ? {} : { environment }),
            ...(registry === undefined ? {} : { registry }),
            yes: flags.yes,
            dryRun: flags.dryRun,
          }).argv.join(' '),
        )
        return
      }

      if (provider === 'circleci') {
        const orgId = get(flags.orgId)
        const projectId = get(flags.projectId)
        const pipelineDefinitionId = get(flags.pipelineDefinitionId)
        const vcsOrigin = get(flags.vcsOrigin)
        if (
          orgId === undefined ||
          projectId === undefined ||
          pipelineDefinitionId === undefined ||
          vcsOrigin === undefined
        ) {
          yield* Console.error('CircleCI trusted setup is missing required ids.')
          return env.exit(1)
        }
        const registry = get(flags.registry)
        yield* Console.log(
          Api.Publisher.Providers.Npm.buildTrustCircleciCommand({
            packageName,
            orgId,
            projectId,
            pipelineDefinitionId,
            vcsOrigin,
            ...(registry === undefined ? {} : { registry }),
            yes: flags.yes,
            dryRun: flags.dryRun,
          }).argv.join(' '),
        )
        return
      }

      yield* Console.error(`Unsupported trusted-publisher provider: ${provider}`)
      return env.exit(1)
    }),
).pipe(Command.withDescription('Render the npm trusted-publisher provisioning command'))

export const trust = Command.make('trust').pipe(
  Command.withDescription('Manage npm trusted-publisher (OIDC) provisioning commands'),
  Command.withSubcommands([trustList, trustSetup, trustVerify]),
  Command.provide(Env.Live),
)
