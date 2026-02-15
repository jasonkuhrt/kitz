import { FileSystem } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release render <format>
 *
 * Render enriched plan data into a specific output format.
 * Reads enriched CommentData JSON from a file or stdin.
 *
 * Formats:
 * - comment - PR comment markdown
 * - tree    - Text tree visualization
 */
const args = Oak.Command.create()
  .use(EffectSchema)
  .description('Render enriched plan data')
  .parameter(
    'format',
    Schema.Literal('comment', 'tree').pipe(
      Schema.annotations({ description: 'Output format: comment or tree' }),
    ),
  )
  .parameter(
    'from-file',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Read enriched JSON from file (otherwise reads stdin)' }),
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

    // Deserialize into CommentData
    const json = JSON.parse(jsonStr)
    const data = Api.Planner.deserializeCommentData(json)

    // Render based on format
    if (args.format === 'comment') {
      yield* Console.log(Api.Planner.renderComment(data))
    } else {
      yield* Console.log(Api.Planner.renderTree(data))
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
