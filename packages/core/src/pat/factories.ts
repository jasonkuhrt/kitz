import type * as S from 'effect/Schema'
import type { PatternForSchema, PatternForV1Schema, PatternForValue } from './types.js'

/**
 * Create a pattern builder from a runtime value.
 *
 * The returned object is typed based on the value's type, providing
 * type-safe pattern construction. This is primarily useful for type
 * inference in scenarios where you have a value and want to build
 * patterns for that value's type.
 *
 * **Note**: This function returns an empty object cast to the pattern type.
 * It's a type-level utility - the actual pattern matching is done by
 * {@link isMatch} and related functions.
 *
 * @template value - The value type (inferred from the argument)
 * @param _value - The value to infer the type from (not used at runtime)
 * @returns A typed object for building patterns
 *
 * @example
 * ```ts
 * const user = { name: 'Alice', age: 30 }
 * const pattern = patternFor(user)
 * // pattern is typed as PatternForValue<{ name: string; age: number }>
 *
 * // Can be used to build type-safe patterns:
 * const agePattern: typeof pattern = { age: { $gte: 18 } }
 * ```
 */
export const patternFor = <value>(_value: value): PatternForValue<value> => {
  return {} as any
}

/**
 * Create a pattern builder from an Effect Schema.
 *
 * Extracts the schema's type and returns a typed object for building
 * patterns. This allows you to define patterns based on schema definitions
 * rather than runtime values.
 *
 * **Note**: This function returns an empty object cast to the pattern type.
 * It's a type-level utility - the actual pattern matching is done by
 * {@link isMatch} and related functions.
 *
 * @template $Schema - The Effect Schema type
 * @param _schema - The Effect Schema (not used at runtime)
 * @returns A typed object for building patterns
 *
 * @example
 * ```ts
 * import * as S from 'effect/Schema'
 *
 * const UserSchema = S.Struct({
 *   name: S.String,
 *   age: S.Number
 * })
 *
 * const pattern = patternForSchema(UserSchema)
 * // pattern is typed as PatternForSchema<typeof UserSchema>
 *
 * // Can be used in type definitions:
 * type Config = {
 *   matching: typeof pattern
 * }
 * ```
 */
export const patternForSchema = <$Schema extends S.Top>(
  _schema: $Schema,
): PatternForSchema<$Schema> => {
  return {} as any
}

/**
 * Create a pattern builder from a v1 Schema (Zod, Yup, etc.).
 *
 * Works with any schema library that follows the v1 schema convention
 * of having an `_output` property (like Zod). Extracts the output type
 * and returns a typed object for building patterns.
 *
 * **Note**: This function returns an empty object cast to the pattern type.
 * It's a type-level utility - the actual pattern matching is done by
 * {@link isMatch} and related functions.
 *
 * @template $Schema - The v1 Schema type
 * @param _schema - The v1 Schema (not used at runtime)
 * @returns A typed object for building patterns
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 *
 * const UserSchema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * })
 *
 * const pattern = patternForV1Schema(UserSchema)
 * // pattern is typed based on Zod's output type
 *
 * // Can be used in type definitions:
 * type Config = {
 *   matching: typeof pattern
 * }
 * ```
 */
export const patternForV1Schema = <$Schema extends { _output: any }>(
  _schema: $Schema,
): PatternForV1Schema<$Schema> => {
  return {} as any
}
