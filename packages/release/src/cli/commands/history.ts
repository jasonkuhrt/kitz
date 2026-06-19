/**
 * @module cli/commands/history
 *
 * Show publish state and history embedded in the PR release preview comment.
 */
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import {
  parsePositiveIntegerOption,
  renderPreviewPublishReport,
  resolvePreviewPublishSurface,
  toPreviewPublishReport,
} from './history-lib.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Show publish state and history from the PR release preview comment')
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['text', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['text', 'json']), {
          decode: SchemaGetter.transform((value) => value ?? 'text'),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'text' })),
  )
  .parameter(
    'pr p',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description: 'Explicit pull request number to inspect instead of the connected branch',
      }),
    ),
  )
  .parameter(
    'limit n',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description: 'Maximum number of publish records to render (default: all)',
      }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, Git.GitLive))(
  Effect.gen(function* () {
    const context = yield* Api.Explorer.resolveGitHubContext()
    const prNumber = yield* parsePositiveIntegerOption(args.pr, 'pr')
    const limit = yield* parsePositiveIntegerOption(args.limit, 'limit')

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
      ...(limit !== undefined ? { limit } : {}),
    })

    yield* Console.log(
      args.format === 'json' ? JSON.stringify(report, null, 2) : renderPreviewPublishReport(report),
    )
  }),
)
