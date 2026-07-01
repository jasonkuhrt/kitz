import { Array, Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeDirAbs, format } from '../analyzer.js'
import { withStatics } from '../core/statics.js'
import { Segment } from './segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Absolute paths can't lead with `..`, so there is no `back`.
 */
class AbsDir__ extends S.TaggedClass<AbsDir__>()('AbsDir', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or `None` for root. */
  get name() {
    return Array.last(this.segments)
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
export class AbsDir_ extends withStatics(
  S.asClass(
    S.String.pipe(
      S.decodeTo(AbsDir__, {
        encode: SchemaGetter.transform((encoded) =>
          format({ isPathAbsolute: true, back: 0 })(encoded.segments),
        ),
        decode: SchemaGetter.transformOrFail(
          flow(
            analyzeDirAbs,
            Result.map((analysis) => ({ _tag: 'AbsDir' as const, segments: analysis.segments })),
            Effect.fromResult,
          ),
        ),
      }),
    ),
  ),
) {}

export const AbsDir = AbsDir_
export type AbsDir = typeof AbsDir_.Type
