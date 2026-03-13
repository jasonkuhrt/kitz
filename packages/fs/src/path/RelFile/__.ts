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
  S.withConstructorDefault(() => Option.some(0)),
)

/**
 * Relative file location class.
 * Internal implementation - use via RelFile namespace.
 */
class RelFileClass extends S.TaggedClass<RelFileClass>()('FsPathRelFile', {
  back: Back,
  segments: Segments,
  fileName: FileName,
}) {
  static make = this.makeUnsafe
  override toString() {
    return S.encodeSync(Schema)(this)
  }

  /** The filename including extension (e.g., `file.txt`). */
  get name(): string {
    return name(this)
  }
}

/**
 * Get the filename including extension.
 */
export const name = (instance: RelFileClass): string =>
  instance.fileName.extension
    ? instance.fileName.stem + instance.fileName.extension
    : instance.fileName.stem

/**
 * Schema for relative file paths with string codec baked in.
 *
 * This schema transforms between string representation (e.g., "./src/index.ts")
 * and the structured RelFile class instance.
 *
 * @example
 * ```ts
 * // Decode from string
 * const file = S.decodeSync(RelFile.Schema)('./src/index.ts')
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   sourcePath: RelFile.Schema,
 *   outputPath: RelFile.Schema
 * })
 * ```
 */
export const Schema: S.Codec<RelFileClass, string> = S.String.pipe(
  S.decodeTo(RelFileClass, {
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

      // Validate it's a relative file
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

      // Valid - return as RelFile
      return Effect.succeed(
        RelFileClass.make({
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
)

/**
 * Type guard to check if a value is a RelFile instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for RelFile from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = (args: ConstructorParameters<typeof RelFileClass>[0]) => new RelFileClass(args)

/**
 * Decode from string to RelFile instance.
 * Throws on invalid input.
 */
export const fromString = <const input extends string>(input: input) => {
  return S.decodeSync(Schema)(input)
}

/**
 * Encode RelFile instance to string.
 */
export const toString = (instance: RelFileClass): string => {
  return S.encodeSync(Schema)(instance)
}
