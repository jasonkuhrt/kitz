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
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
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

const noPackagesMessage =
  'No packages found. Check release.config.ts `packages` field ' +
  'or ensure the root package.json defines workspace packages.'

const preparePrTitle = Effect.gen(function* () {
  const config = yield* Api.Config.load()
  return yield* Api.ProjectedSquashCommit.suggestPrTitle({
    config,
    diffRemote: resolveDiffRemote(config),
  })
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
    if (!prepared) {
      yield* Console.log(noPackagesMessage)
      return
    }

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
    const prepared = yield* preparePrTitle
    if (!prepared) {
      yield* Console.log(noPackagesMessage)
      return
    }

    const result = yield* Api.ProjectedSquashCommit.applyPrTitle({
      pullRequest: prepared.pullRequest,
      projectedHeader: prepared.projectedHeader,
      githubContext: prepared.githubContext,
    })

    if (!result.changed) {
      yield* Console.log('PR title already uses the canonical release header.')
      return
    }

    yield* Console.log(`Updated PR #${String(prepared.pullRequest.number)} title.`)
    yield* Console.log(`Before: \`${result.before}\``)
    yield* Console.log(`After:  \`${result.after}\``)
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
