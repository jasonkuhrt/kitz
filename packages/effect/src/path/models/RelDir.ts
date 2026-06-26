import { Effect, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeDir, format } from '../analyzer.js'
import { NaturalInt } from '../../schema/NaturalInt.js'
import { toIssue } from './core.js'
import { Segment } from './segment.js'

/**
 * Relative directory value — the decoded path (a step array) with instance behavior.
 * Internal; the public binding is {@link RelDir}.
 */
class RelDirValue extends S.TaggedClass<RelDirValue>()('RelDir', {
  /** Count of leading parent-traversal (`..`) steps. */
  back: NaturalInt.pipe(S.withConstructorDefault(Effect.succeed(0))),
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name(): string {
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
export const RelDir = S.String.pipe(
  S.decodeTo(RelDirValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({ isPathAbsolute: false, back: encoded.back, segments: encoded.segments }),
    ),
    decode: SchemaGetter.transformOrFail((input) => {
      const result = analyzeDir(input, { absolute: false })
      return Result.isFailure(result)
        ? Effect.fail(toIssue(result.failure))
        : Effect.succeed({
            _tag: 'RelDir' as const,
            back: result.success.back,
            segments: result.success.segments,
          })
    }),
  }),
)
export type RelDir = typeof RelDir.Type
