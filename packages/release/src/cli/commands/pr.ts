/**
 * @module cli/commands/pr
 *
 * Manage pull-request metadata from release semantics.
 *
 * `release pr preview` updates the PR release preview comment, preserving
 * publish history and failing the job when blocking preview checks remain.
 *
 * `release pr preview --check-only` runs the same release preview checks without
 * creating or updating the PR comment surface.
 *
 * `release pr title suggest` shows the canonical release header for the connected PR
 * and, when possible, the exact title produced by preserving the current subject.
 *
 * `release pr title apply` updates the connected PR title on GitHub by replacing
 * only the conventional-commit header and preserving the current subject verbatim.
 */
import { Cli } from '@kitz/cli'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Console, Effect, Layer } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import { PreviewBlockingError, runPrPreview } from '../pr-preview.js'

const helpFlags = ['-h', '--help'] as const

const formatHelp = (): string =>
  [
    'Usage: release pr <preview|title <suggest|apply>>',
    '',
    'Commands:',
    '  preview         Update the release preview comment and fail on blocking preview checks',
    '                  Pass `--check-only` to run checks without updating the comment',
    '  title suggest   Show the canonical release header and suggested PR title',
    '  title apply     Update the connected PR title by replacing only its header',
  ].join('\n')

type ParsedAction =
  | { readonly _tag: 'preview'; readonly checkOnly: boolean }
  | { readonly _tag: 'title'; readonly action: 'suggest' | 'apply' }

const parseAction = (args: readonly string[]): ParsedAction | null => {
  if (args[0] === 'preview') {
    const previewArgs = args.slice(1)
    const checkOnly = previewArgs.includes('--check-only')
    const unknownPreviewArgs = previewArgs.filter((arg) => arg !== '--check-only')
    if (unknownPreviewArgs.length === 0) {
      return { _tag: 'preview', checkOnly }
    }
  }
  if (args.length < 2 || args[0] !== 'title') return null
  if (args[1] === 'suggest' || args[1] === 'apply') {
    return { _tag: 'title', action: args[1] }
  }
  return null
}

interface PreparedPrTitle {
  readonly pullRequest: {
    readonly number: number
    readonly title: string
    readonly body: string | null
  }
  readonly projectedHeader: string
  readonly suggestedTitle: string | null
  readonly titleRewriteError: string | null
}

const preparePrTitle = Effect.gen(function* () {
  const git = yield* Git.Git
  const config = yield* Api.Config.load()
  const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

  if (packages.length === 0) {
    yield* Console.log(
      'No packages found. Check release.config.ts `packages` field ' +
        'or ensure the root package.json defines workspace packages.',
    )
    return null
  }

  const pullRequest = yield* Api.Explorer.resolvePullRequest()
  if (!pullRequest) {
    return yield* Effect.fail(
      new Api.Explorer.ExplorerError({
        context: {
          detail:
            'Could not resolve an open pull request for the current branch. Set PR_NUMBER explicitly or open a PR first.',
        },
      }),
    )
  }

  const tags = yield* git.getTags()
  const analysis = yield* Api.Analyzer.analyze({ packages, tags })
  const projectedHeader = Api.ProjectedSquashCommit.renderHeader({
    impacts: Api.ProjectedSquashCommit.collectScopeImpacts(analysis),
  })

  if (!projectedHeader) {
    return yield* Effect.fail(
      new Api.Explorer.ExplorerError({
        context: {
          detail: 'No primary release impacts were found, so no canonical PR title header exists.',
        },
      }),
    )
  }

  const rewriteAttempt = yield* ConventionalCommits.Title.rewriteHeader(
    pullRequest.title,
    projectedHeader,
  ).pipe(Effect.result)

  return {
    pullRequest,
    projectedHeader,
    suggestedTitle: rewriteAttempt._tag === 'Success' ? rewriteAttempt.success : null,
    titleRewriteError: rewriteAttempt._tag === 'Failure' ? rewriteAttempt.failure.message : null,
  } satisfies PreparedPrTitle
})

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer, Git.GitLive, ChildProcessSpawnerLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const argv = yield* Cli.parseArgv(env.argv)
    const args = argv.args.slice(1)

    if (args.length === 0 || args.some((arg) => helpFlags.includes(arg as '-h' | '--help'))) {
      yield* Console.log(formatHelp())
      return
    }

    const action = parseAction(args)
    if (!action) {
      yield* Console.error(
        'Error: Expected `release pr preview` or `release pr title <suggest|apply>`.',
      )
      yield* Console.error('')
      yield* Console.error(formatHelp())
      return env.exit(1)
    }

    if (action._tag === 'preview') {
      const previewResult = yield* runPrPreview(
        action.checkOnly ? { checkOnly: true } : undefined,
      ).pipe(Effect.result)

      if (previewResult._tag === 'Failure') {
        if (previewResult.failure instanceof PreviewBlockingError) {
          if (previewResult.failure.commentUrl) {
            yield* Console.log(
              `Updated release preview comment for PR #${String(previewResult.failure.issueNumber)}.`,
            )
            yield* Console.log(`Comment: ${previewResult.failure.commentUrl}`)
          }
          yield* Console.error('Blocking release preview issues remain.')
          return env.exit(1)
        }

        return yield* Effect.fail(previewResult.failure)
      }

      if (previewResult.success._tag === 'checked') {
        yield* Console.log(
          `Release preview checks passed for PR #${String(previewResult.success.issueNumber)}.`,
        )
        return
      }

      yield* Console.log('Updated release preview comment.')
      yield* Console.log(`Comment: ${previewResult.success.issueComment.html_url}`)
      return
    }

    const prepared = yield* preparePrTitle
    if (!prepared) return

    if (action.action === 'suggest') {
      yield* Console.log(`Projected release header: \`${prepared.projectedHeader}\``)

      if (prepared.suggestedTitle) {
        yield* Console.log(`Suggested PR title: \`${prepared.suggestedTitle}\``)
      } else if (prepared.titleRewriteError) {
        yield* Console.log(
          `Current PR title cannot be rewritten automatically: ${prepared.titleRewriteError}`,
        )
      }

      return
    }

    const nextTitle = yield* ConventionalCommits.Title.rewriteHeader(
      prepared.pullRequest.title,
      prepared.projectedHeader,
    )

    if (nextTitle === prepared.pullRequest.title) {
      yield* Console.log('PR title already uses the canonical release header.')
      return
    }

    const token = env.vars['GITHUB_TOKEN']
    if (!token || token.trim() === '') {
      return yield* Effect.fail(
        new Github.GithubConfigError({
          context: {
            detail: 'GITHUB_TOKEN is required to apply PR title updates.',
          },
        }),
      )
    }

    const target = yield* Api.Explorer.resolveReleaseTarget(env.vars)
    const updated = yield* Effect.gen(function* () {
      const github = yield* Github.Github
      return yield* github.updatePullRequest(prepared.pullRequest.number, {
        title: nextTitle,
      })
    }).pipe(Effect.provide(Github.LiveFetch({ owner: target.owner, repo: target.repo, token })))

    yield* Console.log(`Updated PR #${String(updated.number)} title.`)
    yield* Console.log(`Before: \`${prepared.pullRequest.title}\``)
    yield* Console.log(`After:  \`${updated.title}\``)
  }),
)
