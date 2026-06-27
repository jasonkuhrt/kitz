import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeDir, format } from '../analyzer.js'
import { Segment } from './segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Absolute paths can't lead with `..`, so there is no `back`.
 */
class AbsDir__ extends S.TaggedClass<AbsDir__>()('AbsDir', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or empty string for root. */
  get name() {
    return Segment.basename(this.segments)
  }
}

/**
 * `AbsDir` — an absolute directory path, as a `string` ⇄ `AbsDir` value codec.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(AbsDir)('/home/user/')
 * ```
 */
class AbsDir_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(AbsDir__, {
      encode: SchemaGetter.transform((encoded) =>
        format({ isPathAbsolute: true, back: 0 })(encoded.segments),
      ),
      decode: SchemaGetter.transformOrFail(
        flow(
          analyzeDir({ absolute: true }),
          Result.map((analysis) => ({ _tag: 'AbsDir' as const, segments: analysis.segments })),
          Effect.fromResult,
        ),
      ),
    }),
  ),
) {}

export const AbsDir = AbsDir_
export type AbsDir = typeof AbsDir_.Type
