import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { analyze, backPrefix, herePrefix, separator } from '../../path-analyzer/codec-string/__.js'
import { FileName } from '../types/fileName.js'
import { Segments } from '../types/segments.js'

/**
 * Back field with default 0.
 * Represents the count of unresolved parent directory traversals (..).
 * Required in the Type, optional in the constructor (defaults to 0).
 */
const Back = S.Int.pipe(
  S.check(S.isGreaterThanOrEqualTo(0)),
  S.withConstructorDefault(Effect.succeed(0)),
)

/**
 * Relative file value — the decoded path (back + segments + filename) with instance behavior.
 * Internal; the public binding is {@link RelFile}.
 */
class RelFileValue extends S.TaggedClass<RelFileValue>()('FsPathRelFile', {
  back: Back,
  segments: Segments,
  fileName: FileName,
}) {
  /** Encode back to the canonical string form (e.g. `./src/index.ts`). */
  override toString(): string {
    return S.encodeSync(RelFile)(this)
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.extension
      ? this.fileName.stem + this.fileName.extension
      : this.fileName.stem
  }
}

/**
 * `RelFile` — a relative file path.
 *
 * The binding **is** the string codec (`string` ⇄ `RelFile`), usable directly as a
 * schema — `S.Struct({ p: RelFile })`, `S.Union([RelFile, …])` — with no `.Schema` hop.
 *
 * @example
 * ```ts
 * const file = RelFile.fromString('./src/index.ts')
 * const ConfigSchema = S.Struct({ sourcePath: RelFile, outputPath: RelFile })
 * ```
 */
class RelFileCodec extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelFileValue, {
      encode: SchemaGetter.transform((decoded) => {
        // Build the path string from back count and segments
        const backPrefixStr = backPrefix.repeat(decoded.back)
        const pathString = decoded.segments.join(separator)
        const fileString = decoded.fileName.extension
          ? `${decoded.fileName.stem}${decoded.fileName.extension}`
          : decoded.fileName.stem

        // Determine the prefix: use back traversal or current directory marker
        if (decoded.back > 0) {
          return pathString.length > 0
            ? `${backPrefixStr}${pathString}${separator}${fileString}`
            : `${backPrefixStr}${fileString}`
        }
        return pathString.length > 0
          ? `${herePrefix}${pathString}${separator}${fileString}`
          : `${herePrefix}${fileString}`
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
        if (analysis.isPathAbsolute) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(input), {
              message: 'Relative paths must not start with /',
            }),
          )
        }

        return Effect.succeed(
          RelFileValue.make({
            back: analysis.back,
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
  /** Type guard for {@link RelFile} instances. */
  static is = S.is(this)

  /** Decode a relative file path from a string. Throws on invalid input. */
  static fromString = <const input extends string>(input: input): RelFile =>
    S.decodeSync(this)(input)
}

export const RelFile = RelFileCodec
export type RelFile = S.Schema.Type<typeof RelFileCodec>
