/**
 * @module cli/commands/render
 *
 * Render forecast data into a specific output format.
 *
 * Reads a serialized Forecast from a file or stdin and renders it
 * as either a PR comment (markdown) or a text tree visualization.
 * Used by CI workflows to generate PR comment content.
 */
import { FileSystem } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release render <format>
 *
 * Render Forecast data into a specific output format.
 * Reads Forecast JSON from a file or stdin.
 *
 * Formats:
 * - comment - PR comment markdown
 * - tree    - Text tree visualization
 */
const args = Oak.Command.create()
  .use(EffectSchema)
  .description('Render forecast data')
  .parameter(
    'format',
    Schema.Literal('comment', 'tree').pipe(
      Schema.annotations({ description: 'Output format: comment or tree' }),
    ),
  )
  .parameter(
    'from-file',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Read Forecast JSON from file (otherwise reads stdin)' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer))(
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    // Read JSON input from file or stdin
    let jsonStr: string
    if (args.fromFile) {
      jsonStr = yield* fs.readFileString(args.fromFile)
    } else {
      // Read from stdin
      jsonStr = yield* Effect.promise(() => readStdin())
    }

    // Deserialize into Forecast
    const json = JSON.parse(jsonStr)
    const envelope = parseEnvelope(json)
    const fc = Option.match(envelope, {
      onNone: () => Schema.decodeUnknownSync(Api.Forecaster.Forecast)(json),
      onSome: (value) => value.forecast,
    })

    // Render based on format
    if (args.format === 'comment') {
      yield* Console.log(
        Option.match(envelope, {
          onNone: () => Api.Commentator.render(fc),
          onSome: (value) =>
            Api.Commentator.render(fc, {
              publishState: value.publishState,
              publishHistory: value.publishHistory,
            }),
        }),
      )
    } else {
      yield* Console.log(Api.Renderer.renderTree(fc))
    }
  }),
)

const readStdin = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    process.stdin.on('error', reject)
  })
}

const parseEnvelope = (
  json: unknown,
): Option.Option<{
  forecast: Api.Forecaster.Forecast
  publishState: Api.Commentator.PublishState
  publishHistory: readonly Api.Commentator.PublishRecord[]
}> => {
  if (!json || typeof json !== 'object') return Option.none()
  if (!('forecast' in json)) return Option.none()

  const candidate = json as Record<string, unknown>
  const decodedForecast = Schema.decodeUnknownOption(Api.Forecaster.Forecast)(candidate['forecast'])
  if (Option.isNone(decodedForecast)) return Option.none()

  const stateRaw = candidate['publishState']
  const publishState: Api.Commentator.PublishState = stateRaw === 'publishing'
    || stateRaw === 'published'
    || stateRaw === 'failed'
    || stateRaw === 'idle'
    ? stateRaw
    : 'idle'

  const publishHistoryRaw = candidate['publishHistory']
  const publishHistory = Array.isArray(publishHistoryRaw)
    ? publishHistoryRaw.filter((entry): entry is Api.Commentator.PublishRecord =>
      !!entry && typeof entry === 'object')
    : []

  return Option.some({
    forecast: decodedForecast.value,
    publishState,
    publishHistory,
  })
}
