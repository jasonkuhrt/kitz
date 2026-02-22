import { ParseResult, Schema as S } from 'effect'
import type { RefineSchemaId, TypeId } from 'effect/Schema'
import { analyze, backPrefix, herePrefix, separator } from '../../path-analyzer/codec-string/analyzer.js'
import { Segments } from '../types/segments.js'

type _ = RefineSchemaId

/**
 * Property signature for back field with default 0.
 * Represents the count of unresolved parent directory traversals (..).
 */
const Back = S.Int.pipe(
  S.nonNegative(),
  S.propertySignature,
  S.withConstructorDefault(() => 0),
)

/**
 * Relative directory location class.
 * Internal implementation - use via RelDir namespace.
 */
class RelDirClass extends S.TaggedClass<RelDirClass>()('FsPathRelDir', {
  back: Back,
  segments: Segments,
}) {
  override toString() {
    return S.encodeSync(Schema)(this)
  }

  /** The directory name (last segment), or empty string for current/parent-only paths. */
  get name(): string {
    return name(this)
  }
}

/**
 * Get the directory name (last segment), or empty string for current/parent-only paths.
 */
export const name = (instance: RelDirClass): string => instance.segments.at(-1) ?? ''

/**
 * Schema for relative directory paths with string codec baked in.
 *
 * This schema transforms between string representation (e.g., "./src/")
 * and the structured RelDir class instance.
 *
 * @example
 * ```ts
 * // Decode from string
 * const dir = S.decodeSync(RelDir.Schema)('./src/')
 *
 * // Use in struct (expects string input)
 * const ConfigSchema = S.Struct({
 *   sourcePath: RelDir.Schema,
 *   outputPath: RelDir.Schema
 * })
 * ```
 */
export const Schema: S.Schema<RelDirClass, string> = S.transformOrFail(
  S.String,
  RelDirClass,
  {
    strict: true,
    encode: (decoded) => {
      // Build the path string from back count and segments
      const backPrefixStr = backPrefix.repeat(decoded.back)
      const pathString = decoded.segments.join(separator)

      // Determine the prefix: use back traversal or current directory marker
      if (decoded.back > 0) {
        // Back traversal: "../" repeated, then segments, then trailing slash
        // e.g., back=2, segments=['lib'] -> '../../lib/'
        // e.g., back=1, segments=[] -> '../'
        return ParseResult.succeed(
          pathString.length > 0 ? `${backPrefixStr}${pathString}${separator}` : backPrefixStr,
        )
      }
      // Forward path: "./" prefix, then segments, then trailing slash
      // e.g., back=0, segments=['src'] -> './src/'
      // e.g., back=0, segments=[] -> './'
      return ParseResult.succeed(pathString.length > 0 ? `${herePrefix}${pathString}${separator}` : herePrefix)
    },
    decode: (input, options, ast) => {
      // Analyze the input string with directory hint for ambiguous paths
      const analysis = analyze(input, { hint: 'directory' })

      // Validate it's a relative directory
      if (analysis._tag !== 'dir') {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Expected a directory path, got a file path'),
        )
      }
      if (analysis.isPathAbsolute) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, 'Relative paths must not start with /'),
        )
      }

      // Valid - return as RelDir
      return ParseResult.succeed(
        RelDirClass.make({
          back: analysis.back,
          segments: analysis.path,
        }),
      )
    },
  },
)

/**
 * Type guard to check if a value is a RelDir instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for RelDir from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = RelDirClass.make.bind(RelDirClass)

/**
 * Decode from string to RelDir instance.
 * Throws on invalid input.
 */
export const fromString = <const input extends string>(input: input) => {
  return S.decodeSync(Schema)(input)
}

/**
 * Encode RelDir instance to string.
 */
export const toString = (instance: RelDirClass): string => {
  return S.encodeSync(Schema)(instance)
}
