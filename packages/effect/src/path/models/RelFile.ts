import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze, backSegment, herePrefix, separator } from '../analyzer.js'
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
    let count = 0
    for (const segment of this.segments) {
      if (segment._tag === 'Up') count++
      else break
    }
    return count
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return this.fileName.stem + Option.getOrElse(this.fileName.extension, () => '')
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
const codec = S.String.pipe(
  S.decodeTo(RelFileValue, {
    // The encode getter receives the ENCODED form — segments are already `string[]`
    // (Up steps encoded as '..'); only the leading `./` marker is conditional.
    encode: SchemaGetter.transform((encoded) => {
      const pathString = encoded.segments.join(separator)
      const fileString = encoded.fileName.extension
        ? `${encoded.fileName.stem}${encoded.fileName.extension}`
        : encoded.fileName.stem
      if (encoded.segments.length === 0) return `${herePrefix}${fileString}`
      const prefix = encoded.segments[0] === backSegment ? '' : herePrefix
      return `${prefix}${pathString}${separator}${fileString}`
    }),
    // The decode getter returns the ENCODED form; the schema decodes `string[]` → `Segment[]`.
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

      return Effect.succeed({
        _tag: 'RelFile' as const,
        // Fold the unresolved `..` count into leading Up steps (encoded as '..').
        segments: [...Array.from({ length: analysis.back }, () => backSegment), ...analysis.path],
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
export type RelFile = typeof codec.Type
