import { Array, Effect, flow, type Option, Result, Schema as S, SchemaGetter } from 'effect'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { analyzeDirRel, format } from '../analyzer.js'
import { parentOf } from '../core/segments.js'
import { withStatics } from '../core/statics.js'
import { AbsDir } from './AbsDir.js'
import { Segment } from './segment.js'

/**
 * Relative directory value — the decoded path (ascent count + segments) with instance behavior.
 */
class RelDir__ extends S.TaggedClass<RelDir__>()('RelDir', {
  /** Count of leading parent-traversal (`..`) steps. */
  ascent: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or `None` for current/parent-only paths. */
  get name(): Option.Option<Segment> {
    return Array.last(this.segments)
  }

  /** The parent directory — drops the last segment (grows `ascent` when segment-less). */
  get parent(): RelDir {
    const parent = parentOf(this.ascent, this.segments)
    return RelDir_.make({ ascent: parent.ascent, segments: parent.segments })
  }

  /** The directory re-anchored at the filesystem root, dropping `ascent` traversal (`./src/` → `/src/`). To resolve against a base directory instead, use the flat `ensureAbs`. */
  get atRoot(): AbsDir {
    return AbsDir.make({ segments: this.segments })
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
export class RelDir_ extends withStatics(
  S.asClass(
    S.String.pipe(
      S.decodeTo(RelDir__, {
        encode: SchemaGetter.transform((encoded) =>
          format({ isPathAbsolute: false, ascent: encoded.ascent })(encoded.segments),
        ),
        decode: SchemaGetter.transformOrFail(
          flow(
            analyzeDirRel,
            Result.map((analysis) => ({
              _tag: 'RelDir' as const,
              ascent: analysis.ascent,
              segments: analysis.segments,
            })),
            Effect.fromResult,
          ),
        ),
      }),
    ),
  ),
) {}

export const RelDir = RelDir_
export type RelDir = typeof RelDir_.Type
