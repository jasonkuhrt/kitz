import { ParseResult, Schema as S } from 'effect'
import type { RefineSchemaId } from 'effect/Schema'
import { analyze } from '../../path-analyzer/codec-string/analyzer.js'
import { stringSeparator } from '../constants.js'
import { Segments } from '../types/segments.js'

type _ = RefineSchemaId

/**
 * Absolute directory location class.
 * Internal implementation - use via AbsDir namespace.
 */
class AbsDirClass extends S.TaggedClass<AbsDirClass>()('FsPathAbsDir', {
  segments: Segments,
}) {
  override toString() {
    return S.encodeSync(Schema)(this)
  }

  /** The directory name (last segment), or empty string for root. */
  get name(): string {
    return name(this)
  }
}

/**
 * Get the directory name (last segment), or empty string for root.
 */
export const name = (instance: AbsDirClass): string => instance.segments.at(-1) ?? ''

/**
 * Schema for absolute directory paths with string codec baked in.
 *
 * This schema transforms between string representation (e.g., "/home/user/")
 * and the structured AbsDir class instance.
 *
 * @example
 * ```ts
 * // Decode from string
 * const dir = S.decodeSync(AbsDir.Schema)('/home/user/')
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   sourcePath: AbsDir.Schema,
 *   outputPath: AbsDir.Schema
 * })
 * ```
 */
export const Schema: S.Schema<AbsDirClass, string> = S.transformOrFail(
  S.String,
  AbsDirClass,
  {
    strict: true,
    encode: (decoded) => {
      const pathString = decoded.segments.join(stringSeparator)
      const string = decoded.segments.length === 0 ? '/' : `/${pathString}/`
      return ParseResult.succeed(string)
    },
    decode: (input, options, ast) => {
      // Analyze the input string with directory hint for ambiguous paths
      const analysis = analyze(input, { hint: 'directory' })

      // Validate it's an absolute directory
      if (analysis._tag !== 'dir') {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Expected a directory path, got a file path'),
        )
      }
      if (!analysis.isPathAbsolute) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Absolute paths must start with /'),
        )
      }

      // Valid - return as AbsDir
      return ParseResult.succeed(
        AbsDirClass.make({
          segments: analysis.path,
        }),
      )
    },
  },
)

/**
 * Type guard to check if a value is an AbsDir instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for AbsDir from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = AbsDirClass.make.bind(AbsDirClass)

/**
 * Decode from string to AbsDir instance.
 * Throws on invalid input.
 */
export const fromString = <const input extends string>(input: input) => {
  return S.decodeSync(Schema)(input)
}

/**
 * Encode AbsDir instance to string.
 */
export const toString = (instance: AbsDirClass): string => {
  return S.encodeSync(Schema)(instance)
}
