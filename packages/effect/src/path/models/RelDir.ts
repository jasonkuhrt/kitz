import { Effect, flow, Result, Schema as S, SchemaGetter } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { analyzeDir, format } from '../analyzer.js'
import { Segment } from './segment.js'

/**
 * Relative directory value — the decoded path (back count + segments) with instance behavior.
 */
class RelDir__ extends S.TaggedClass<RelDir__>()('RelDir', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name() {
    return Segment.basename(this.segments)
  }
}

/**
 * `RelDir` — a relative directory path, as a `string` ⇄ `RelDir` value codec.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(RelDir)('./src/')
 * ```
 */
export class RelDir_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelDir__, {
      encode: SchemaGetter.transform((encoded) =>
        format({ isPathAbsolute: false, back: encoded.back })(encoded.segments),
      ),
      decode: SchemaGetter.transformOrFail(
        flow(
          analyzeDir({ absolute: false }),
          Result.map((analysis) => ({
            _tag: 'RelDir' as const,
            back: analysis.back,
            segments: analysis.segments,
          })),
          Effect.fromResult,
        ),
      ),
    }),
  ),
) {}

export const RelDir = RelDir_
export type RelDir = typeof RelDir_.Type
