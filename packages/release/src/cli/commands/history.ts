/**
 * @module cli/commands/history
 *
 * Show publish state and history embedded in the PR release preview comment.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Console, Effect, Layer, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Explorer from '../../api/explorer/__.js'
import {
  renderPreviewPublishReport,
  resolvePreviewPublishSurface,
  toPreviewPublishReport,
} from './history-lib.js'

const PositiveInt = Schema.Number.check(
  Schema.isInt({ message: 'Expected an integer' }),
  Schema.isBetween(
    { minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    { message: 'Expected a positive integer' },
  ),
)

export const history = Command.make(
  'history',
  {
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('text'),
    ),
    pr: Flag.integer('pr').pipe(
      Flag.withAlias('p'),
      Flag.withDescription(
        'Explicit pull request number to inspect instead of the connected branch',
      ),
      Flag.withSchema(PositiveInt),
      Flag.optional,
    ),
    limit: Flag.integer('limit').pipe(
      Flag.withAlias('n'),
      Flag.withDescription('Maximum number of publish records to render (default: all)'),
      Flag.withSchema(PositiveInt),
      Flag.optional,
    ),
  },
  ({ format, pr, limit }) =>
    Effect.gen(function* () {
      const context = yield* Explorer.resolveGitHubContext()
      const prNumber = Option.getOrUndefined(pr)
      const limitValue = Option.getOrUndefined(limit)

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
