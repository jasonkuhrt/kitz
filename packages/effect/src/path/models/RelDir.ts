import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, backSegment, herePrefix, separator } from '../analyzer.js'
import { back } from './core.js'
import { Segment } from './segment/Segment.js'

/**
 * Relative directory value — the decoded path (a step array) with instance behavior.
 * Internal; the public binding is {@link RelDir}.
 */
class RelDirValue extends S.TaggedClass<RelDirValue>()('RelDir', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
}) {
  /** Encode back to the canonical string form (e.g. `./src/`). */
  override toString(): string {
    return S.encodeSync(RelDir)(this)
  }

  /** Count of leading parent-traversal (`..`) steps, derived from {@link segments}. */
  get back(): number {
    return back(this.segments)
  }

  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name(): string {
    const last = this.segments.at(-1)
    return last !== undefined && last._tag === 'Name' ? last.name : ''
  }
}

/**
 * `RelDir` — a relative directory path. The binding **is** the `string` ⇄ `RelDir`
 * codec (usable directly as a schema) and carries `is` / `fromString` statics via
 * {@link Statics.Codec}.
 *
 * @example
 * ```ts
 * const dir = RelDir.fromString('./src/')
 * ```
 */
const codec = S.String.pipe(
  S.decodeTo(RelDirValue, {
    // The encode getter receives the ENCODED form — segments are already `string[]`
    // (Up steps encoded as '..'); only the leading `./` marker is conditional.
    encode: SchemaGetter.transform((encoded) => {
      const pathString = encoded.segments.join(separator)
      if (encoded.segments.length === 0) return herePrefix
      const startsWithBack = encoded.segments[0] === backSegment
      return startsWithBack ? `${pathString}${separator}` : `${herePrefix}${pathString}${separator}`
    }),
    decode: SchemaGetter.transformOrFail((input) => {
      const analysis = analyze(input, { hint: 'directory' })
      if (analysis._tag !== 'dir') {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Expected a directory path, got a file path',
          }),
        )
      }
      if (analysis.isPathAbsolute) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Relative paths must not start with /',
          }),
        )
      }
      // The decode getter returns the ENCODED form; the schema decodes `string[]` → `Segment[]`.
      return Effect.succeed({
        _tag: 'RelDir' as const,
        // Fold the unresolved `..` count into leading Up steps (encoded as '..').
        segments: [...Array.from({ length: analysis.back }, () => backSegment), ...analysis.path],
      })
    }),
  }),
)

export const RelDir = codec
export type RelDir = typeof RelDir.Type
