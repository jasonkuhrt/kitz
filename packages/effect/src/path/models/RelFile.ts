import { Effect, Result, Option, Schema as S, SchemaGetter } from 'effect'
import { analyzeFile, format } from '../analyzer.js'
import { Back, toIssue } from './core.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Relative file value — the decoded path (a step array + filename) with instance behavior.
 * Internal; the public binding is {@link RelFile}.
 */
class RelFileValue extends S.TaggedClass<RelFileValue>()('RelFile', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: Back.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.stem + Option.getOrElse(this.fileName.extension, () => '')
  }
}

/**
 * `RelFile` — a relative file path, as a `string` ⇄ `RelFile` value codec.
 * The decoded value has `.name`.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(RelFile)('./src/index.ts')
 * ```
 */
export const RelFile = S.String.pipe(
  S.decodeTo(RelFileValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({
        isPathAbsolute: false,
        back: encoded.back,
        segments: encoded.segments,
        fileName: encoded.fileName,
      }),
    ),
    decode: SchemaGetter.transformOrFail((input) => {
      const result = analyzeFile(input, { absolute: false })
      return Result.isFailure(result)
        ? Effect.fail(toIssue(result.failure))
        : Effect.succeed({
            _tag: 'RelFile' as const,
            back: result.success.back,
            segments: result.success.segments,
            fileName: {
              _tag: 'FileName' as const,
              stem: result.success.file.stem,
              extension: result.success.file.extension,
            },
          })
    }),
  }),
)
export type RelFile = typeof RelFile.Type
