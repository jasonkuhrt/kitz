import type * as S from 'effect/Schema'
import type { ArrayConstraint, Combinator, NumberConstraint, StringConstraint } from './compiler.js'

/**
 * String pattern - matches string values.
 *
 * Supports:
 * - Literal strings
 * - Regular expressions
 * - String constraints (`$length`, `$format`)
 * - Effect Schemas
 */
export type StringPattern = string | RegExp | StringConstraint | S.Top

/**
 * Number pattern - matches number values.
 *
 * Supports:
 * - Literal numbers
 * - Number constraints (`$gt`, `$gte`, `$lt`, `$lte`, `$eq`)
 * - Effect Schemas
 */
export type NumberPattern = number | NumberConstraint | S.Top

/**
 * Boolean pattern - matches boolean values.
 *
 * Supports:
 * - Literal booleans
 * - Effect Schemas
 */
export type BooleanPattern = boolean | S.Top

/**
 * BigInt pattern - matches bigint values.
 *
 * Supports:
 * - Literal bigints
 * - Effect Schemas
 */
export type BigIntPattern = bigint | S.Top

/**
 * Date pattern - matches Date values.
 *
 * Supports:
 * - Literal dates
 * - Effect Schemas
 */
export type DatePattern = Date | S.Top

/**
 * Array pattern - matches array values.
 *
 * Supports:
 * - Tuple matching (array of patterns)
 * - Array constraints (`$some`, `$every`, `$length`)
 *
 * @template $Element - The type of array elements
 */
export type ArrayPattern<$Element> =
  | PatternForType<$Element>[] // Tuple matching
  | ArrayConstraint // $some, $every, $length

/**
 * Object pattern - matches object values with partial matching.
 *
 * All properties are optional, allowing partial pattern matching.
 * Each property can be matched with a pattern for that property's type.
 *
 * @template $T - The object type
 */
export type ObjectPattern<$T extends object> = {
  [k in keyof $T]?: PatternForType<$T[k]>
}

/**
 * Core type utility that maps any TypeScript type to valid pattern syntax.
 *
 * This is the foundation for all pattern type utilities. It recursively
 * maps types to their pattern representations:
 * - Primitives → literals, constraints, or schemas
 * - Objects → partial object patterns with nested patterns
 * - Arrays → tuple patterns or array constraints
 * - Always allows combinators (`$not`, `$or`, `$and`)
 *
 * @template $T - The type to create a pattern for
 *
 * @example
 * ```ts
 * type User = { name: string; age: number }
 * type UserPattern = PatternForType<User>
 * // Allows: { name: /^J/, age: { $gte: 18 } }
 * ```
 */
export type PatternForType<$T> = PatternForTypeValue<$T> | Combinator // Always allow $not, $or, $and

type PatternForTypeValue<$T> =
  // Primitives
  $T extends string
    ? StringPattern
    : $T extends number
      ? NumberPattern
      : $T extends boolean
        ? BooleanPattern
        : $T extends bigint
          ? BigIntPattern
          : $T extends Date
            ? DatePattern
            : $T extends null
              ? null
              : // Collections
                $T extends Array<infer __element__>
                ? ArrayPattern<__element__>
                : $T extends object
                  ? ObjectPattern<$T>
                  : // Fallback - literal
                    $T

/**
 * Pattern type for a runtime value.
 *
 * This is an alias for {@link PatternForType} for clarity when working
 * with value types rather than schema types.
 *
 * @template $Value - The value type to create a pattern for
 *
 * @example
 * ```ts
 * const user = { name: 'Alice', age: 30 }
 * type UserPattern = PatternForValue<typeof user>
 * ```
 */
export type PatternForValue<$Value> = PatternForType<$Value>

/**
 * Pattern type for an Effect Schema.
 *
 * Extracts the schema's type using `Schema.Type` and creates a pattern for it.
 *
 * @template $Schema - The Effect Schema to create a pattern for
 *
 * @example
 * ```ts
 * const UserSchema = S.Struct({ name: S.String, age: S.Number })
 * type UserPattern = PatternForSchema<typeof UserSchema>
 * ```
 */
export type PatternForSchema<$Schema extends S.Top> = PatternForType<$Schema['Type']>

/**
 * Pattern type for a v1 Schema (Zod, Yup, etc.).
 *
 * Works with any schema that has an `_output` property, which is the
 * convention used by Zod and similar validation libraries.
 *
 * @template $Schema - The v1 Schema to create a pattern for
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * const UserSchema = z.object({ name: z.string(), age: z.number() })
 * type UserPattern = PatternForV1Schema<typeof UserSchema>
 * ```
 */
export type PatternForV1Schema<$Schema extends { _output: any }> = PatternForType<
  $Schema['_output']
>
