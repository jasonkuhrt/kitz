import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, backSegment, herePrefix, separator } from '../path-analyzer/codec-string/__.js'
import { FileName } from './FileName.js'
import { Segments } from './Segments.js'

/**
 * Relative file value — the decoded path (a step array + filename) with instance behavior.
 * Internal; the public binding is {@link RelFile}.
 */
class RelFileValue extends S.TaggedClass<RelFileValue>()('FsPathRelFile', {
  segments: Segments,
  fileName: FileName,
}) {
  /** Encode back to the canonical string form (e.g. `./src/index.ts`). */
  override toString(): string {
    return S.encodeSync(RelFile)(this)
  }

  /** Count of leading parent-traversal (`..`) steps, derived from {@link segments}. */
  get back(): number {
    let count = 0
    for (const segment of this.segments) {
      if (segment._tag === 'Up') count++
      else break
    }
    return count
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
class RelFile_ extends S.asClass(
  S.String.pipe(
    S.decodeTo(RelFileValue, {
      encode: SchemaGetter.transform((decoded) => {
        // Steps carry their own `..`, so the encoded segment array already includes
        // any parent traversals; only the leading `./` marker is conditional.
        const pathString = S.encodeSync(Segments)(decoded.segments).join(separator)
        const fileString = decoded.fileName.extension
          ? `${decoded.fileName.stem}${decoded.fileName.extension}`
          : decoded.fileName.stem
        if (decoded.segments.length === 0) return `${herePrefix}${fileString}`
        const prefix = decoded.segments[0]?._tag === 'Up' ? '' : herePrefix
        return `${prefix}${pathString}${separator}${fileString}`
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
            // Fold the unresolved `..` count into leading Up steps.
            segments: S.decodeSync(Segments)([
              ...Array.from({ length: analysis.back }, () => backSegment),
              ...analysis.path,
            ]),
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
  static readonly is = S.is(this)

  /** Decode a relative file path from a string. Throws on invalid input. */
  static readonly fromString = <const input extends string>(input: input): RelFile =>
    S.decodeSync(this)(input)
}

export const RelFile = RelFile_
export type RelFile = typeof RelFile_.Type
