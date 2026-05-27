import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Console, Effect } from 'effect'
import * as Api from '../../api/__.js'

const valueAfter = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const has = (args: readonly string[], name: string): boolean => args.includes(name)

const printUsage = Console.error(
  [
    'Usage:',
    '  release trust list [--pkg <name>] [--registry <url>]',
    '  release trust setup --provider github --pkg <name> --workflow <file> --repo <owner/name> [--env <name>]',
    '  release trust setup --provider gitlab --pkg <name> --file <path> --project <namespace/project> [--env <name>]',
    '  release trust setup --provider circleci --pkg <name> --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> --vcs-origin <origin>',
    '  release trust verify --from <plan>',
  ].join('\n'),
)

Cli.run(Env.Live)(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const argv = yield* Cli.parseArgv(env.argv)
    const args = argv.args.slice(1)
    const action = args[0] ?? 'list'

    if (action === 'list') {
      const packageName = valueAfter(args, '--pkg')
      const registry = valueAfter(args, '--registry')
      yield* Console.log(
        Api.Publisher.Providers.Npm.buildTrustListCommand({
          ...(packageName === undefined ? {} : { packageName }),
          ...(registry === undefined ? {} : { registry }),
          json: has(args, '--json'),
        }).argv.join(' '),
      )
      return
    }

    if (action === 'verify') {
      const from = valueAfter(args, '--from')
      if (from === undefined) {
        yield* Console.error('Missing required --from <plan>.')
        return env.exit(1)
      }
      yield* Console.log(`Trusted-publisher verification is plan-bound: ${from}`)
      return
    }

    if (action !== 'setup') {
      yield* printUsage
      return env.exit(1)
    }

    const provider = valueAfter(args, '--provider')
    const packageName = valueAfter(args, '--pkg')
    if (provider === undefined || packageName === undefined) {
      yield* Console.error('Missing required --provider and --pkg.')
      return env.exit(1)
    }

    if (provider === 'github') {
      const workflow = valueAfter(args, '--workflow')
      const repository = valueAfter(args, '--repo')
      if (workflow === undefined || repository === undefined) {
        yield* Console.error('GitHub trusted setup requires --workflow and --repo.')
        return env.exit(1)
      }
      const environment = valueAfter(args, '--env')
      const registry = valueAfter(args, '--registry')
      yield* Console.log(
        Api.Publisher.Providers.Npm.buildTrustGithubCommand({
          packageName,
          repository,
          workflowFile: workflow,
          ...(environment === undefined ? {} : { environment }),
          ...(registry === undefined ? {} : { registry }),
          yes: has(args, '--yes'),
          dryRun: has(args, '--dry-run'),
        }).argv.join(' '),
      )
      return
    }

    if (provider === 'gitlab') {
      const workflow = valueAfter(args, '--file')
      const project = valueAfter(args, '--project')
      if (workflow === undefined || project === undefined) {
        yield* Console.error('GitLab trusted setup requires --file and --project.')
        return env.exit(1)
      }
      const environment = valueAfter(args, '--env')
      const registry = valueAfter(args, '--registry')
      yield* Console.log(
        Api.Publisher.Providers.Npm.buildTrustGitlabCommand({
          packageName,
          project,
          workflowFile: workflow,
          ...(environment === undefined ? {} : { environment }),
          ...(registry === undefined ? {} : { registry }),
          yes: has(args, '--yes'),
          dryRun: has(args, '--dry-run'),
        }).argv.join(' '),
      )
      return
    }

    if (provider === 'circleci') {
      const orgId = valueAfter(args, '--org-id')
      const projectId = valueAfter(args, '--project-id')
      const pipelineDefinitionId = valueAfter(args, '--pipeline-definition-id')
      const vcsOrigin = valueAfter(args, '--vcs-origin')
      if (
        orgId === undefined ||
        projectId === undefined ||
        pipelineDefinitionId === undefined ||
        vcsOrigin === undefined
      ) {
        yield* Console.error('CircleCI trusted setup is missing required ids.')
        return env.exit(1)
      }
      const registry = valueAfter(args, '--registry')
      yield* Console.log(
        Api.Publisher.Providers.Npm.buildTrustCircleciCommand({
          packageName,
          orgId,
          projectId,
          pipelineDefinitionId,
          vcsOrigin,
          ...(registry === undefined ? {} : { registry }),
          yes: has(args, '--yes'),
          dryRun: has(args, '--dry-run'),
        }).argv.join(' '),
      )
      return
    }

    yield* Console.error(`Unsupported trusted-publisher provider: ${provider}`)
    return env.exit(1)
  }),
)
