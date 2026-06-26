import { Effect, Result, Schema as S, SchemaGetter } from 'effect'
import { analyzeFile, format } from '../analyzer.js'
import { toIssue } from './core.js'
import { FileName } from './FileName.js'
import { Segment } from './segment.js'

/**
 * Absolute file value — the decoded path (segments + filename) with instance behavior.
 * Internal; the public binding is {@link AbsFile}. Absolute paths can't lead with `..`,
 * so there is no `back`.
 */
class AbsFileValue extends S.TaggedClass<AbsFileValue>()('AbsFile', {
  segments: S.Array(Segment).pipe(S.withConstructorDefault(Effect.succeed([]))),
  fileName: FileName,
}) {
  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return FileName.render(this.fileName)
  }
}

/**
 * `AbsFile` — an absolute file path, as a `string` ⇄ `AbsFile` value codec.
 * The decoded value has `.name`.
 *
 * @example
 * ```ts
 * const file = S.decodeSync(AbsFile)('/home/user/file.txt')
 * ```
 */
export const AbsFile = S.String.pipe(
  S.decodeTo(AbsFileValue, {
    encode: SchemaGetter.transform((encoded) =>
      format({
        isPathAbsolute: true,
        back: 0,
        segments: encoded.segments,
        fileName: encoded.fileName,
      }),
    ),
    decode: SchemaGetter.transformOrFail((input) => {
      const result = analyzeFile(input, { absolute: true })
      return Result.isFailure(result)
        ? Effect.fail(toIssue(result.failure))
        : Effect.succeed({
            _tag: 'AbsFile' as const,
            segments: result.success.segments,
            fileName: {
              _tag: 'FileName' as const,
              stem: result.success.file.stem,
              extension: result.success.file.extension,
            },
          })
    }),
  }),
)
export type AbsFile = typeof AbsFile.Type
