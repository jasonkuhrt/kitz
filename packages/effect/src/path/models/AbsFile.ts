import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, format } from '../analyzer.js'
import { FileName } from './FileName.js'
import { Segment } from './segment/Segment.js'

/**
 * Absolute file value — the decoded path (segments + filename) with instance behavior.
 * Internal; the public binding is {@link AbsFile}. Absolute paths can't lead with `..`,
 * so there is no `back`.
 */
class AbsFileValue extends S.TaggedClass<AbsFileValue>()('AbsFile', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** Encode back to the canonical string form (e.g. `/home/user/file.txt`). */
  override toString(): string {
    return S.encodeSync(AbsFile)(this)
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.stem + Option.getOrElse(this.fileName.extension, () => '')
  }
}

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 * The decoded value has `.name` and `.toString()`.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(AbsFile)('/home/user/file.txt')
 * ```
 */
const codec = S.String.pipe(
  S.decodeTo(AbsFileValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({ isPathAbsolute: true, segments: encoded.segments, fileName: encoded.fileName }),
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
      if (!analysis.isPathAbsolute) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Absolute paths must start with /',
          }),
        )
      }
      return Effect.succeed({
        _tag: 'AbsFile' as const,
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

export const AbsFile = codec
export type AbsFile = typeof AbsFile.Type
