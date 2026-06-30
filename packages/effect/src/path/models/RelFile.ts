import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { analyzeFile, format } from '../analyzer.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Relative file value — the decoded path (back count + segments + filename).
 */
class RelFile__ extends S.TaggedClass<RelFile__>()('RelFile', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {}

/**
 * `RelFile` — a relative file path, as a `string` ⇄ `RelFile` value codec.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(RelFile)('./src/index.ts')
 * ```
 */
export class RelFile_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelFile__, {
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
            fileName: analysis.fileName,
          })),
          Effect.fromResult,
        ),
      ),
    }),
  ),
) {}

export const RelFile = RelFile_
export type RelFile = typeof RelFile_.Type
