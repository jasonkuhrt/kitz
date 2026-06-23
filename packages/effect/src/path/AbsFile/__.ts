import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { analyze } from '../../path-analyzer/codec-string/__.js'
import { FileName } from '../types/fileName.js'
import { Segments } from '../types/segments.js'

/**
 * Absolute file value — the decoded path (segments + filename) with instance behavior.
 * Internal; the public binding is {@link AbsFile}.
 */
class AbsFileValue extends S.TaggedClass<AbsFileValue>()('FsPathAbsFile', {
  segments: Segments,
  fileName: FileName,
}) {
  /** Encode back to the canonical string form (e.g. `/home/user/file.txt`). */
  override toString(): string {
    return S.encodeSync(AbsFile)(this)
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.extension
      ? this.fileName.stem + this.fileName.extension
      : this.fileName.stem
  }
}

/**
 * `AbsFile` — an absolute file path.
 *
 * The binding **is** the string codec (`string` ⇄ `AbsFile`), so it can be used
 * directly as a schema — `S.Struct({ p: AbsFile })`, `S.Union([AbsFile, …])` — with
 * no `.Schema` hop, and carries the constructors as statics. The decoded value is a
 * class instance with `.name` and `.toString()`.
 *
 * @example
 * ```ts
 * const file = AbsFile.fromString('/home/user/file.txt')
 * const ConfigSchema = S.Struct({ sourcePath: AbsFile, outputPath: AbsFile })
 * ```
 */
class AbsFileCodec extends S.asClass(
  S.String.pipe(
    S.decodeTo(AbsFileValue, {
      encode: SchemaGetter.transform((decoded) => {
        // Source of truth for string conversion
        const pathString = decoded.segments.join('/')
        const fileString = decoded.fileName.extension
          ? `${decoded.fileName.stem}${decoded.fileName.extension}`
          : decoded.fileName.stem
        return pathString.length > 0 ? `/${pathString}/${fileString}` : `/${fileString}`
      }),
      decode: SchemaGetter.transformOrFail((input) => {
        // Analyze the input string with file hint for ambiguous dotfiles
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

        return Effect.succeed(
          AbsFileValue.make({
            segments: analysis.path,
            fileName: FileName.make({
              stem: analysis.file.stem,
              extension: analysis.file.extension,
            }),
          }),
        )
      }),
    }),
  ),
) {
  /** Type guard for {@link AbsFile} instances. */
  static is = S.is(this)

  /** Decode an absolute file path from a string. Throws on invalid input. */
  static fromString = <const input extends string>(input: input): AbsFile =>
    S.decodeSync(this)(input)
}

export const AbsFile = AbsFileCodec
export type AbsFile = S.Schema.Type<typeof AbsFileCodec>
