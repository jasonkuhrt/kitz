/**
 * @module cli/commands/history
 *
 * Show publish state and history embedded in the PR release preview comment.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Explorer from '../../api/explorer/__.js'
import {
  parsePositiveIntegerOption,
  renderPreviewPublishReport,
  resolvePreviewPublishSurface,
  toPreviewPublishReport,
} from './history-lib.js'

export const history = Command.make(
  'history',
  {
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('text'),
    ),
    pr: Flag.string('pr').pipe(
      Flag.withAlias('p'),
      Flag.withDescription(
        'Explicit pull request number to inspect instead of the connected branch',
      ),
      Flag.optional,
    ),
    limit: Flag.string('limit').pipe(
      Flag.withAlias('n'),
      Flag.withDescription('Maximum number of publish records to render (default: all)'),
      Flag.optional,
    ),
  },
  ({ format, pr, limit }) =>
    Effect.gen(function* () {
      const context = yield* Explorer.resolveGitHubContext()
      const prNumber = yield* parsePositiveIntegerOption(Option.getOrUndefined(pr), 'pr')
      const limitValue = yield* parsePositiveIntegerOption(Option.getOrUndefined(limit), 'limit')

      const surface = yield* resolvePreviewPublishSurface(context, {
        ...(prNumber !== undefined ? { prNumber } : {}),
      }).pipe(
        Effect.provide(
          Github.LiveFetch({
            owner: context.target.owner,
            repo: context.target.repo,
            ...(context.token ? { token: context.token } : {}),
          }),
        ),
      )

      const report = toPreviewPublishReport(surface, {
        ...(limitValue !== undefined ? { limit: limitValue } : {}),
      })

      yield* Console.log(
        format === 'json' ? JSON.stringify(report, null, 2) : renderPreviewPublishReport(report),
      )
    }),
).pipe(
  Command.withDescription('Show publish state and history from the PR release preview comment'),
  Command.provide(Layer.mergeAll(Env.Live, Git.GitLive)),
)
