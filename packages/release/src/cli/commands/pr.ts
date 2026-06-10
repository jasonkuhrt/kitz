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
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Config from '../../api/config.js'
import * as Explorer from '../../api/explorer/__.js'
import * as ProjectedSquashCommit from '../../api/projected-squash-commit.js'
import { ChildProcessSpawnerLayer, FileSystemLayer, TerminalLayer } from '../../platform.js'
import { resolveDiffRemote } from '../pr-preview-diff.js'
import { PreviewBlockingError, runPrPreview } from '../pr-preview.js'

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

const PrCommandLayer = Layer.mergeAll(
  Env.Live,
  FileSystemLayer,
  TerminalLayer,
  Git.GitLive,
  ChildProcessSpawnerLayer,
  npmLayer,
)

const preparePrTitle = Effect.gen(function* () {
  const git = yield* Git.Git
  const config = yield* Config.load()
  const packages = yield* Analyzer.Workspace.resolvePackages(config.packages)

  if (packages.length === 0) {
    yield* Console.log(
      'No packages found. Check release.config.ts `packages` field ' +
        'or ensure the root package.json defines workspace packages.',
    )
    return null
  }

  const pullRequestContext = yield* Explorer.resolvePullRequestContext()
  const pullRequest = pullRequestContext.pullRequest
  if (!pullRequest) {
    return yield* Effect.fail(
      new Explorer.ExplorerError({
        context: {
          detail:
            'Could not resolve an open pull request for the current branch. Set PR_NUMBER explicitly or open a PR first.',
        },
      }),
    )
  }

  const tags = yield* git.getTags()
  const remote = resolveDiffRemote(config)
  const analysis = yield* Analyzer.analyze({
    packages,
    tags,
    since: `${remote}/${pullRequest.base.ref}`,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
    commitOverrides: config.commitOverrides,
  })
  const projectedHeader = ProjectedSquashCommit.renderHeader({
    impacts: ProjectedSquashCommit.collectScopeImpacts(analysis, { primaryOnly: true }),
  })

  if (!projectedHeader) {
    return yield* Effect.fail(
      new Explorer.ExplorerError({
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
    githubContext: pullRequestContext,
    pullRequest,
    projectedHeader,
    suggestedTitle: rewriteAttempt._tag === 'Success' ? rewriteAttempt.success : null,
    titleRewriteError: rewriteAttempt._tag === 'Failure' ? rewriteAttempt.failure.message : null,
  }
})

const prPreview = Command.make(
  'preview',
  {
    checkOnly: Flag.boolean('check-only').pipe(
      Flag.withDescription('Run release preview checks without updating the PR comment'),
      Flag.withDefault(false),
    ),
    remote: Flag.string('remote').pipe(
      Flag.withDescription('Override the PR diff remote for this run'),
      Flag.optional,
    ),
  },
  ({ checkOnly, remote }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const remoteValue = Option.isSome(remote) ? remote.value : undefined

      const previewResult = yield* runPrPreview(
        checkOnly || remoteValue
          ? {
              ...(checkOnly ? { checkOnly: true } : {}),
              ...(remoteValue ? { remote: remoteValue } : {}),
            }
          : undefined,
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
    }),
).pipe(
  Command.withDescription('Update the release preview comment and fail on blocking preview checks'),
)

const prTitleSuggest = Command.make('suggest', {}, () =>
  Effect.gen(function* () {
    const prepared = yield* preparePrTitle
    if (!prepared) return

    yield* Console.log(`Projected release header: \`${prepared.projectedHeader}\``)

    if (prepared.suggestedTitle) {
      yield* Console.log(`Suggested PR title: \`${prepared.suggestedTitle}\``)
    } else if (prepared.titleRewriteError) {
      yield* Console.log(
        `Current PR title cannot be rewritten automatically: ${prepared.titleRewriteError}`,
      )
    }
  }),
).pipe(Command.withDescription('Show the canonical release header and suggested PR title'))

const prTitleApply = Command.make('apply', {}, () =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const prepared = yield* preparePrTitle
    if (!prepared) return

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

    const updated = yield* Effect.gen(function* () {
      const github = yield* Github.Github
      return yield* github.updatePullRequest(prepared.pullRequest.number, {
        title: nextTitle,
      })
    }).pipe(
      Effect.provide(
        Github.LiveFetch({
          owner: prepared.githubContext.target.owner,
          repo: prepared.githubContext.target.repo,
          token,
        }),
      ),
    )

    yield* Console.log(`Updated PR #${String(updated.number)} title.`)
    yield* Console.log(`Before: \`${prepared.pullRequest.title}\``)
    yield* Console.log(`After:  \`${updated.title}\``)
  }),
).pipe(Command.withDescription('Update the connected PR title by replacing only its header'))

const prTitle = Command.make('title').pipe(
  Command.withDescription('Inspect or rewrite the connected PR title release header'),
  Command.withSubcommands([prTitleSuggest, prTitleApply]),
)

export const pr = Command.make('pr').pipe(
  Command.withDescription('Maintain the release preview comment or canonical PR title'),
  Command.withSubcommands([prPreview, prTitle]),
  Command.provide(PrCommandLayer),
)
