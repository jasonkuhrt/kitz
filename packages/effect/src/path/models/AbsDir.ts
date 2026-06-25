import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { stringSeparator } from '../constants.js'
import { analyze } from '../analyzer.js'
import { Segment } from './segment/Segment.js'

/**
 * Absolute directory value — the decoded path (segments) with instance behavior.
 * Internal; the public binding is {@link AbsDir}. Absolute paths can't lead with `..`,
 * so there is no `back`.
 */
class AbsDirValue extends S.TaggedClass<AbsDirValue>()('AbsDir', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** Encode back to the canonical string form (e.g. `/home/user/`). */
  override toString(): string {
    return S.encodeSync(AbsDir)(this)
  }

  /** The directory name (last segment), or empty string for root. */
  get name(): string {
    const last = this.segments.at(-1)
    return last !== undefined && last._tag === 'Name' ? last.name : ''
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
const codec = S.String.pipe(
  S.decodeTo(AbsDirValue, {
    // The encode getter receives the ENCODED form — segments are already `string[]`.
    encode: SchemaGetter.transform((encoded) => {
      const pathString = encoded.segments.join(stringSeparator)
      return encoded.segments.length === 0 ? '/' : `/${pathString}/`
    }),
    // The decode getter returns the ENCODED form; the schema decodes `string[]` → `Segment[]`.
    decode: SchemaGetter.transformOrFail((input) => {
      const analysis = analyze(input, { hint: 'directory' })

      if (analysis._tag !== 'dir') {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Expected a directory path, got a file path',
          }),
        )
      }
      if (!analysis.isPathAbsolute) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Absolute paths must start with /',
          }),
        )
      }

      return Effect.succeed({
        _tag: 'AbsDir' as const,
        segments: analysis.path,
      })
    }),
  }),
)

export const AbsDir = codec
export type AbsDir = typeof AbsDir.Type
