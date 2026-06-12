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
 *
 * Decision logic lives in `pr-lib.ts`; this file is thin wiring.
 */
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { TerminalLayer, ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer, failWith } from './_shared.js'
import { PreviewBlockingError, PrPreviewLive, preparePrTitle, runPrPreview } from './pr-lib.js'

const PrBaseLayer = Layer.mergeAll(
  CommandBaseLayer,
  TerminalLayer,
  Git.GitLive,
  ChildProcessSpawnerLayer,
  NpmCliLayer,
)

const PrCommandLayer = Layer.mergeAll(PrBaseLayer, PrPreviewLive.pipe(Layer.provide(PrBaseLayer)))

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
      const remoteValue = Option.getOrUndefined(remote)

      const previewResult = yield* runPrPreview({
        ...(checkOnly ? { checkOnly: true } : {}),
        ...(remoteValue ? { remote: remoteValue } : {}),
      }).pipe(Effect.result)

      if (previewResult._tag === 'Failure') {
        if (previewResult.failure instanceof PreviewBlockingError) {
          if (previewResult.failure.commentUrl) {
            yield* Console.log(
              `Updated release preview comment for PR #${String(previewResult.failure.issueNumber)}.`,
            )
            yield* Console.log(`Comment: ${previewResult.failure.commentUrl}`)
          }
          yield* failWith('Blocking release preview issues remain.')
          return
        }

        yield* Effect.fail(previewResult.failure)
        return
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
      yield* Effect.fail(
        new Github.GithubConfigError({
          context: {
            detail: 'GITHUB_TOKEN is required to apply PR title updates.',
          },
        }),
      )
      return
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
