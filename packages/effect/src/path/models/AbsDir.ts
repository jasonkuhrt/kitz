import { Effect, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeDir, format } from '../analyzer.js'
import { toIssue } from './core.js'
import { Segment } from './segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Internal; the public binding is {@link AbsDir}. Absolute paths can't lead with `..`,
 * so there is no `back`.
 */
class AbsDirValue extends S.TaggedClass<AbsDirValue>()('AbsDir', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** The directory name (last segment), or empty string for root. */
  get name(): string {
    return Segment.basename(this.segments)
  }
}

/**
 * `AbsDir` — an absolute directory path, as a `string` ⇄ `AbsDir` value codec.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(AbsDir)('/home/user/')
 * const ConfigSchema = S.Struct({ sourcePath: AbsDir, outputPath: AbsDir })
 * ```
 */
export const AbsDir = S.String.pipe(
  S.decodeTo(AbsDirValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({ isPathAbsolute: true, back: 0, segments: encoded.segments }),
    ),
    decode: SchemaGetter.transformOrFail((input) => {
      const result = analyzeDir(input, { absolute: true })
      return Result.isFailure(result)
        ? Effect.fail(toIssue(result.failure))
        : Effect.succeed({ _tag: 'AbsDir' as const, segments: result.success.segments })
    }),
  }),
)
export type AbsDir = typeof AbsDir.Type
