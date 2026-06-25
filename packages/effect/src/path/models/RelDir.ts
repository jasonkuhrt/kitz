import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, format } from '../analyzer.js'
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
 * `RelDir` — a relative directory path, as a `string` ⇄ `RelDir` value codec.
 *
 * @example
 * ```ts
 * const dir = S.decodeSync(RelDir)('./src/')
 * ```
 */
const codec = S.String.pipe(
  S.decodeTo(RelDirValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({ isPathAbsolute: false, segments: encoded.segments }),
    ),
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
      return Effect.succeed({ _tag: 'RelDir' as const, segments: analysis.segments })
    }),
  }),
)

export const RelDir = codec
export type RelDir = typeof RelDir.Type
