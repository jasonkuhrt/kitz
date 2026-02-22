import { ParseResult, Schema as S } from 'effect'
import type { RefineSchemaId, TypeId } from 'effect/Schema'
import { analyze } from '../../path-analyzer/codec-string/analyzer.js'
import { FileName } from '../types/fileName.js'
import { Segments } from '../types/segments.js'

type _ = RefineSchemaId

/**
 * Absolute file location class.
 * Internal implementation - use via AbsFile namespace.
 */
class AbsFileClass extends S.TaggedClass<AbsFileClass>()('FsPathAbsFile', {
  segments: Segments,
  fileName: FileName,
}) {
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
export const name = (instance: AbsFileClass): string =>
  instance.fileName.extension
    ? instance.fileName.stem + instance.fileName.extension
    : instance.fileName.stem

/**
 * Schema for absolute file paths with string codec baked in.
 *
 * This schema transforms between string representation (e.g., "/home/user/file.txt")
 * and the structured AbsFile class instance.
 *
 * @example
 * ```ts
 * // Decode from string
 * const file = S.decodeSync(AbsFile.Schema)('/home/user/file.txt')
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   sourcePath: AbsFile.Schema,
 *   outputPath: AbsFile.Schema
 * })
 * ```
 */
export const Schema: S.Schema<AbsFileClass, string> = S.transformOrFail(
  S.String,
  AbsFileClass,
  {
    strict: true,
    encode: (decoded) => {
      // Source of truth for string conversion
      const pathString = decoded.segments.join('/')
      const fileString = decoded.fileName.extension
        ? `${decoded.fileName.stem}${decoded.fileName.extension}`
        : decoded.fileName.stem
      return ParseResult.succeed(pathString.length > 0 ? `/${pathString}/${fileString}` : `/${fileString}`)
    },
    decode: (input, options, ast) => {
      // Analyze the input string with file hint for ambiguous dotfiles
      const analysis = analyze(input, { hint: 'file' })

      // Validate it's an absolute file
      if (analysis._tag !== 'file') {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Expected a file path, got a directory path'),
        )
      }
      if (!analysis.isPathAbsolute) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Absolute paths must start with /'),
        )
      }

      // Valid - return as AbsFile
      return ParseResult.succeed(
        AbsFileClass.make({
          segments: analysis.path,
          fileName: FileName.make({
            stem: analysis.file.stem,
            extension: analysis.file.extension,
          }),
        }),
      )
    },
  },
)

/**
 * Type guard to check if a value is an AbsFile instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for AbsFile from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = AbsFileClass.make.bind(AbsFileClass)

/**
 * Decode from string to AbsFile instance.
 * Throws on invalid input.
 */
export const fromString = <const input extends string>(input: input) => {
  return S.decodeSync(Schema)(input)
}

/**
 * Encode AbsFile instance to string.
 */
export const toString = (instance: AbsFileClass): string => {
  return S.encodeSync(Schema)(instance)
}
