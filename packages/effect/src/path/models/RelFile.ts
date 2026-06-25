import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, format } from '../analyzer.js'
import { back } from './core.js'
import { FileName } from './FileName.js'
import { Segment } from './segment/Segment.js'

/**
 * Relative file value — the decoded path (a step array + filename) with instance behavior.
 * Internal; the public binding is {@link RelFile}.
 */
class RelFileValue extends S.TaggedClass<RelFileValue>()('RelFile', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** Encode back to the canonical string form (e.g. `./src/index.ts`). */
  override toString(): string {
    return S.encodeSync(RelFile)(this)
  }

  /** Count of leading parent-traversal (`..`) steps, derived from {@link segments}. */
  get back(): number {
    return back(this.segments)
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.stem + Option.getOrElse(this.fileName.extension, () => '')
  }
}

/**
 * `RelFile` — a relative file path, as a `string` ⇄ `RelFile` value codec.
 * The decoded value has `.name` and `.toString()`.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(RelFile)('./src/index.ts')
 * ```
 */
const codec = S.String.pipe(
  S.decodeTo(RelFileValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({ isPathAbsolute: false, segments: encoded.segments, fileName: encoded.fileName }),
    ),
    decode: SchemaGetter.transformOrFail((input) => {
      const analysis = analyze(input, { hint: 'file' })
      if (analysis._tag !== 'file') {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Expected a file path, got a directory path',
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
      return Effect.succeed({
        _tag: 'RelFile' as const,
        segments: analysis.segments,
        fileName: {
          _tag: 'FileName' as const,
          stem: analysis.file.stem,
          extension: analysis.file.extension,
        },
      })
    }),
  }),
)

export const RelFile = codec
export type RelFile = typeof RelFile.Type
