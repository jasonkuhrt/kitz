import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFile, format } from '../analyzer.js'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Relative file value — the decoded path (a step array + filename) with instance behavior.
 * Internal; the public binding is {@link RelFile}.
 */
class RelFileValue extends S.TaggedClass<RelFileValue>()('RelFile', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return FileName.render(this.fileName)
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
      format({ isPathAbsolute: false, back: encoded.back, fileName: encoded.fileName })(
        encoded.segments,
      ),
    ),
    decode: SchemaGetter.transformOrFail(
      flow(
        analyzeFile({ absolute: false }),
        Result.map((analysis) => ({
          _tag: 'RelFile' as const,
          back: analysis.back,
          segments: analysis.segments,
          fileName: {
            _tag: 'FileName' as const,
            stem: analysis.file.stem,
            extension: analysis.file.extension,
          },
        })),
        Effect.fromResult,
      ),
    ),
  }),
)
export type RelFile = typeof RelFile.Type
