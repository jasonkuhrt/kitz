import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { analyze, backPrefix, herePrefix, separator } from '../../path-analyzer/codec-string/__.js'
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
 * Relative directory location class.
 * Internal implementation - use via RelDir namespace.
 */
class RelDirClass extends S.TaggedClass<RelDirClass>()('FsPathRelDir', {
  back: Back,
  segments: Segments,
}) {
  static make = this.makeUnsafe
  static is = S.is(RelDirClass)
  static decode = S.decodeUnknownEffect(RelDirClass)
  static decodeSync = S.decodeUnknownSync(RelDirClass)
  static encode = S.encodeUnknownEffect(RelDirClass)
  static encodeSync = S.encodeUnknownSync(RelDirClass)
  static equivalence = S.toEquivalence(RelDirClass)
  static ordered = false as const
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
export const Schema: S.Codec<RelDirClass, string> = S.String.pipe(
  S.decodeTo(RelDirClass, {
    encode: SchemaGetter.transform((decoded) => {
      // Build the path string from back count and segments
      const backPrefixStr = backPrefix.repeat(decoded.back)
      const pathString = decoded.segments.join(separator)

      // Determine the prefix: use back traversal or current directory marker
      if (decoded.back > 0) {
        return pathString.length > 0 ? `${backPrefixStr}${pathString}${separator}` : backPrefixStr
      }
      return pathString.length > 0 ? `${herePrefix}${pathString}${separator}` : herePrefix
    }),
    decode: SchemaGetter.transformOrFail((input) => {
      // Analyze the input string with directory hint for ambiguous paths
      const analysis = analyze(input, { hint: 'directory' })

      // Validate it's a relative directory
      if (analysis._tag !== 'dir') {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Expected a directory path, got a file path',
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

      // Valid - return as RelDir
      return Effect.succeed(
        RelDirClass.make({
          back: analysis.back,
          segments: analysis.path,
        }),
      )
    }),
  }),
)

/**
 * Type guard to check if a value is a RelDir instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for RelDir from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = (args: ConstructorParameters<typeof RelDirClass>[0]) => new RelDirClass(args)

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
