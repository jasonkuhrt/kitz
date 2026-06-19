/**
 * @module cli/commands/forecast
 *
 * Render a read-only release forecast from the current repo or a saved forecast file.
 *
 * Forecasts are lifecycle-agnostic: they always project official versions for human review.
 * Output formats support scan-heavy CLI viewing (`table`, `tree`), shareable markdown (`md`),
 * and machine exchange (`json`).
 */
import { Cli } from '@kitz/cli'
import { Oak } from '@kitz/oak'
import { Console, Effect, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import {
  buildForecastInput,
  ForecastCommandLayer,
  loadForecastInputFromFile,
} from './forecast-lib.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Render a release forecast')
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['table', 'tree', 'md', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['table', 'tree', 'md', 'json']), {
          decode: SchemaGetter.transform((value) => value ?? 'table'),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'table' })),
  )
  .parameter(
    'from-file',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description: 'Read saved forecast JSON from a file instead of computing from the repo',
      }),
    ),
  )
  .parse()

Cli.run(ForecastCommandLayer)(
  Effect.gen(function* () {
    const input = yield* args.fromFile
      ? loadForecastInputFromFile(args.fromFile)
      : buildForecastInput()

    const rendered =
      args.format === 'table'
        ? Api.Renderer.renderTable(input.forecast)
        : args.format === 'tree'
          ? Api.Renderer.renderTree(input.forecast)
          : args.format === 'md'
            ? Api.Renderer.renderForecastMarkdown(input.forecast, {
                publishState: input.publishState,
                publishHistory: input.publishHistory,
              })
            : Api.Forecaster.encodeForecastEnvelope({
                forecast: input.forecast,
                publishState: input.publishState,
                publishHistory: input.publishHistory,
              })

    yield* Console.log(rendered)
  }),
)
