import { Effect, Option, Schema as S, SchemaGetter, SchemaIssue } from 'effect'
import { analyze } from '../path-analyzer/codec-string/__.js'
import { asClassPath } from './core.js'
import { FileName } from './FileName.js'
import { Segment } from './Segment.js'

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
    return this.fileName.extension
      ? this.fileName.stem + this.fileName.extension
      : this.fileName.stem
  }
}

/**
 * `AbsFile` — an absolute file path. The binding **is** the `string` ⇄ `AbsFile`
 * codec (usable directly as a schema) and carries `is` / `fromString` via
 * {@link asClassPath}. The decoded value has `.name` and `.toString()`.
 *
 * @example
 * ```ts
 * const file = AbsFile.fromString('/home/user/file.txt')
 * ```
 */
const codec = S.String.pipe(
  S.decodeTo(AbsFileValue, {
    // The encode getter receives the ENCODED form — segments are already `string[]`.
    encode: SchemaGetter.transform((decoded) => {
      const pathString = decoded.segments.join('/')
      const fileString = decoded.fileName.extension
        ? `${decoded.fileName.stem}${decoded.fileName.extension}`
        : decoded.fileName.stem
      return pathString.length > 0 ? `/${pathString}/${fileString}` : `/${fileString}`
    }),
    // The decode getter returns the ENCODED form; the schema decodes `string[]` → `Segment[]`.
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
        segments: analysis.path,
        fileName: FileName.make({ stem: analysis.file.stem, extension: analysis.file.extension }),
      })
    }),
  }),
)

export const AbsFile = asClassPath(codec)
export type AbsFile = typeof AbsFile.Type
