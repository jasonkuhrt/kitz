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
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'

const PublishStateSchema = Schema.Literal('idle', 'publishing', 'published', 'failed')
const PublishRecordSchema = Schema.Struct({
  package: Schema.String,
  version: Schema.String,
  iteration: Schema.Number,
  sha: Schema.String,
  timestamp: Schema.String,
  runId: Schema.String,
})
const JsonRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })
const JsonTextSchema = Schema.parseJson()

const decodeJsonText = Schema.decodeUnknown(JsonTextSchema)
const decodeJsonRecord = Schema.decodeUnknownOption(JsonRecordSchema)
const decodeForecast = Schema.decodeUnknown(Api.Forecaster.Forecast)
const decodePublishState = Schema.decodeUnknownOption(PublishStateSchema)
const decodePublishHistory = Schema.decodeUnknownOption(Schema.Array(PublishRecordSchema))

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
  .use(Oak.EffectSchema)
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
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    // Read JSON input from file or stdin
    let jsonStr: string
    if (args.fromFile) {
      jsonStr = yield* fs.readFileString(args.fromFile)
    } else {
      // Read from stdin
      jsonStr = yield* readStdin()
    }

    const json = yield* decodeJsonText(jsonStr)
    const envelope = parseEnvelope(json)
    const fc = Option.isSome(envelope) ? envelope.value.forecast : yield* decodeForecast(json)

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

const readStdin = (): Effect.Effect<string, Error> =>
  Effect.async((resume) => {
    const chunks: Buffer[] = []
    const onData = (chunk: Buffer) => chunks.push(chunk)
    const onEnd = () => {
      cleanup()
      resume(Effect.succeed(Buffer.concat(chunks).toString('utf8')))
    }
    const onError = (error: Error) => {
      cleanup()
      resume(Effect.fail(error))
    }
    const cleanup = () => {
      process.stdin.off('data', onData)
      process.stdin.off('end', onEnd)
      process.stdin.off('error', onError)
    }

    process.stdin.on('data', onData)
    process.stdin.once('end', onEnd)
    process.stdin.once('error', onError)
    process.stdin.resume()

    return Effect.sync(cleanup)
  })

const parseEnvelope = (
  json: unknown,
): Option.Option<{
  forecast: Api.Forecaster.Forecast
  publishState: Api.Commentator.PublishState
  publishHistory: readonly Api.Commentator.PublishRecord[]
}> => {
  return decodeJsonRecord(json).pipe(
    Option.flatMap((candidate) =>
      Option.fromNullable(candidate['forecast']).pipe(
        Option.flatMap(Schema.decodeUnknownOption(Api.Forecaster.Forecast)),
        Option.map((forecast) => ({
          forecast,
          publishState: Option.fromNullable(candidate['publishState']).pipe(
            Option.flatMap(decodePublishState),
            Option.getOrElse((): Api.Commentator.PublishState => 'idle'),
          ),
          publishHistory: Option.fromNullable(candidate['publishHistory']).pipe(
            Option.flatMap(decodePublishHistory),
            Option.getOrElse((): readonly Api.Commentator.PublishRecord[] => []),
          ),
        })),
      ),
    ),
  )
}
