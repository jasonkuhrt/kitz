import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFile, format } from '../analyzer.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Absolute file value — the decoded path (segments + filename).
 * Absolute paths can't lead with `..`, so there is no `back`.
 */
class AbsFile__ extends S.TaggedClass<AbsFile__>()('AbsFile', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {}

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(AbsFile)('/home/user/file.txt')
 * ```
 */
export class AbsFile_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(AbsFile__, {
      encode: SchemaGetter.transform((encoded) =>
        format({ isPathAbsolute: true, back: 0, fileName: encoded.fileName })(encoded.segments),
      ),
      decode: SchemaGetter.transformOrFail(
        flow(
          analyzeFile('absolute'),
          Result.map((analysis) => ({
            _tag: 'AbsFile' as const,
            segments: analysis.segments,
            fileName: analysis.fileName,
          })),
          Effect.fromResult,
        ),
      ),
    }),
  ),
) {}

export const AbsFile = AbsFile_
export type AbsFile = typeof AbsFile_.Type
