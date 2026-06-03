/**
 * @module cli/commands/forecast
 *
 * Render a read-only release forecast from the current repo or a saved forecast file.
 *
 * Forecasts are lifecycle-agnostic: they always project official versions for human review.
 * Output formats support scan-heavy CLI viewing (`table`, `tree`), shareable markdown (`md`),
 * and machine exchange (`json`).
 */
import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import {
  buildForecastInput,
  ForecastCommandLayer,
  loadForecastInputFromFile,
} from './forecast-lib.js'

export const forecast = Command.make(
  'forecast',
  {
    format: Flag.choice('format', ['table', 'tree', 'md', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('table'),
    ),
    fromFile: Flag.string('from-file').pipe(
      Flag.withDescription(
        'Read saved forecast JSON from a file instead of computing from the repo',
      ),
      Flag.optional,
    ),
  },
  ({ format, fromFile }) =>
    Effect.gen(function* () {
      const input = yield* Option.isSome(fromFile)
        ? loadForecastInputFromFile(fromFile.value)
        : buildForecastInput()

      const rendered =
        format === 'table'
          ? Api.Renderer.renderTable(input.forecast)
          : format === 'tree'
            ? Api.Renderer.renderTree(input.forecast)
            : format === 'md'
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
).pipe(Command.withDescription('Render a release forecast'), Command.provide(ForecastCommandLayer))
