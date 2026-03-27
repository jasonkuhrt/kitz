import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { analyze } from '../../path-analyzer/codec-string/__.js'
import { stringSeparator } from '../constants.js'
import { Segments } from '../types/segments.js'

/**
 * Absolute directory location class.
 * Internal implementation - use via AbsDir namespace.
 */
class AbsDirClass extends S.TaggedClass<AbsDirClass>()('FsPathAbsDir', {
  segments: Segments,
}) {
  static make = this.makeUnsafe
  static is = S.is(AbsDirClass)
  static decode = S.decodeUnknownEffect(AbsDirClass)
  static decodeSync = S.decodeUnknownSync(AbsDirClass)
  static encode = S.encodeUnknownEffect(AbsDirClass)
  static encodeSync = S.encodeUnknownSync(AbsDirClass)
  static equivalence = S.toEquivalence(AbsDirClass)
  static ordered = false as const
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
export const Schema: S.Codec<AbsDirClass, string> = S.String.pipe(
  S.decodeTo(AbsDirClass, {
    encode: SchemaGetter.transform((decoded) => {
      const pathString = decoded.segments.join(stringSeparator)
      const string = decoded.segments.length === 0 ? '/' : `/${pathString}/`
      return string
    }),
    decode: SchemaGetter.transformOrFail((input) => {
      // Analyze the input string with directory hint for ambiguous paths
      const analysis = analyze(input, { hint: 'directory' })

      // Validate it's an absolute directory
      if (analysis._tag !== 'dir') {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Expected a directory path, got a file path',
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

      // Valid - return as AbsDir
      return Effect.succeed(
        AbsDirClass.make({
          segments: analysis.path,
        }),
      )
    }),
  }),
)

/**
 * Type guard to check if a value is an AbsDir instance.
 */
export const is = S.is(Schema)

/**
 * Direct constructor for AbsDir from structured data.
 * Bypasses string parsing for efficient internal operations.
 */
export const make = (args: ConstructorParameters<typeof AbsDirClass>[0]) => new AbsDirClass(args)

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
