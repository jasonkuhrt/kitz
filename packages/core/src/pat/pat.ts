import { CoreFn as Fn } from '#fn/core'
import * as S from 'effect/Schema'
import { toSchema } from './compiler.js'
import type { PatternForType } from './types.js'

/**
 * Pattern type for declarative matching.
 *
 * All patterns are pure data structures that compile to Effect Schemas.
 * This type is properly typed based on the value type, providing type-safe
 * pattern construction.
 *
 * Supports:
 * - **Literals**: `42`, `'hello'`, `true`, `null`
 * - **RegExp**: `/^test/`, `/\\d+/i`
 * - **Effect Schemas**: `S.String`, `S.Number.pipe(S.positive)`
 * - **String constraints**: `{ $length: 5 }`, `{ $length: { $gte: 3, $lte: 10 } }`, `{ $format: /^[A-Z]/ }`
 * - **Number constraints**: `{ $gt: 0, $lte: 100 }`, `{ $gte: 5 }`
 * - **Array constraints**: `{ $some: pattern }`, `{ $every: pattern }`, `{ $length: 3 }`
 * - **Objects** (partial matching): `{ name: 'John' }` matches `{ name: 'John', age: 30 }`
 * - **Nested patterns**: `{ user: { name: /^J/, age: { $gt: 18 } } }`
 * - **Combinators**:
 *   - `{ $not: pattern }` - negation
 *   - `{ $or: [pattern1, pattern2] }` - union
 *   - `{ $and: [pattern1, pattern2] }` - intersection
 *
 * @template $Value - The type of value to match
 *
 * @example
 * ```ts
 * // Literals
 * isMatch(42, 42) // true
 * isMatch('hello', 'world') // false
 *
 * // Regex
 * isMatch('hello', /^h/) // true
 *
 * // String constraints
 * isMatch('hello', { $length: 5 }) // true
 * isMatch('hello', { $length: { $gte: 3, $lte: 10 } }) // true
 * isMatch('hello', { $format: /^[a-z]+$/ }) // true
 *
 * // Number constraints
 * isMatch(5, { $gt: 0, $lte: 10 }) // true
 * isMatch(-5, { $gte: 0 }) // false
 *
 * // Array constraints
 * isMatch([1, 2, 3], { $some: { $gt: 2 } }) // true
 * isMatch([2, 4, 6], { $every: { $gte: 2 } }) // true
 * isMatch([1, 2], { $length: 2 }) // true
 *
 * // Objects (partial matching)
 * isMatch({ a: 1, b: 2 }, { a: 1 }) // true
 * isMatch({ name: 'Alice', age: 30 }, { name: S.String, age: { $gte: 18 } }) // true
 *
 * // Combinators
 * isMatch(5, { $not: S.String }) // true
 * isMatch('hello', { $or: [S.String, S.Number] }) // true
 * isMatch({ a: 1, b: 2 }, { $and: [{ a: 1 }, { b: 2 }] }) // true
 * ```
 */
export type Pattern<$Value = unknown> = PatternForType<$Value>

/**
 * Checks if a value matches a pattern.
 *
 * All patterns are compiled to Effect Schemas and validated using `Schema.is()`.
 * This provides a declarative, composable way to match values against complex patterns.
 *
 * See {@link Pattern} for the full pattern syntax.
 *
 * @template value - The type of the value to match
 * @param value - The value to check
 * @param pattern - The pattern to match against
 * @returns True if the value matches the pattern, false otherwise
 *
 * @example
 * ```ts
 * // String constraints
 * isMatch('hello', { length: { gte: 3 } }) // true
 *
 * // Number constraints
 * isMatch(5, { gt: 0, lt: 10 }) // true
 *
 * // Array constraints
 * isMatch([1, 2, 3], { some: { gt: 2 } }) // true
 * isMatch(['a', 'b'], { every: S.String }) // true
 *
 * // Object partial matching
 * isMatch({ name: 'Alice', age: 30 }, { age: { gte: 18 } }) // true
 *
 * // Combinators
 * isMatch(5, { not: S.String }) // true
 * isMatch('test', { and: [S.String, { length: 4 }] }) // true
 * ```
 */
export const isMatch = <value>(value: value, pattern: Pattern<value>): boolean => {
  const schema = toSchema(pattern)
  return S.is(schema as any)(value)
}

/**
 * Curried version of {@link isMatch} with value first.
 *
 * Returns a function that checks if the given value matches patterns.
 * Useful for testing a value against multiple patterns.
 *
 * Follows Kit convention: `On` suffix takes the data/subject (value to operate ON).
 *
 * @template value - The type of the value to match
 * @param value - The value to match against patterns
 * @returns A function that takes a pattern and returns true if the value matches it
 *
 * @example
 * ```ts
 * const user = { name: 'John', role: 'admin', age: 30 }
 * const matchesUser = isMatchOn(user)
 *
 * // Test against multiple patterns
 * matchesUser({ role: 'admin' }) // true
 * matchesUser({ age: { $gte: 18 } }) // true
 * matchesUser({ name: /^J/ }) // true
 * matchesUser({ name: 'Jane' }) // false
 *
 * // Find matching patterns
 * const patterns = [
 *   { role: 'admin' },
 *   { age: { $lt: 18 } },
 *   { name: /^J/ }
 * ]
 * patterns.filter(matchesUser) // [{ role: 'admin' }, { name: /^J/ }]
 * ```
 */
export const isMatchOn =
  <value>(value: value) =>
  (pattern: Pattern<value>): boolean => {
    return isMatch(value, pattern)
  }

/**
 * Curried version of {@link isMatch} with pattern first.
 *
 * Returns a function that checks if values match the given pattern.
 * Useful for filtering, finding, and other higher-order operations.
 *
 * Follows Kit convention: `With` suffix takes the configuration/parameters (pattern to match WITH).
 *
 * @template value - The type of values to match
 * @param pattern - The pattern to match against
 * @returns A function that takes a value and returns true if it matches the pattern
 *
 * @example
 * ```ts
 * // Filter with constraints
 * const isPositive = isMatchWith({ $gt: 0 })
 * [-1, 0, 1, 2].filter(isPositive) // [1, 2]
 *
 * // Filter with object patterns
 * const isAdmin = isMatchWith({ role: 'admin' })
 * users.filter(isAdmin) // All admin users
 *
 * // Filter with regex
 * const startsWithA = isMatchWith(/^a/i)
 * ['Alice', 'Bob', 'Anne'].filter(startsWithA) // ['Alice', 'Anne']
 *
 * // Array filtering
 * const hasLargeNumbers = isMatchWith({ $some: { $gt: 100 } })
 * [[1, 3], [200, 4], [1, 2]].filter(hasLargeNumbers) // [[200, 4]]
 * ```
 */
export const isMatchWith =
  <value>(pattern: Pattern<value>) =>
  (value: value): boolean => {
    return isMatch(value, pattern)
  }

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Re-exports
//
//

/**
 * Re-export pattern compiler for advanced usage.
 */
export { toSchema } from './compiler.js'
export type { ArrayConstraint, Combinator, NumberConstraint, StringConstraint } from './compiler.js'

/**
 * Re-export type-level pattern utilities.
 */
export type {
  ArrayPattern,
  BigIntPattern,
  BooleanPattern,
  DatePattern,
  NumberPattern,
  ObjectPattern,
  PatternForSchema,
  PatternForType,
  PatternForV1Schema,
  PatternForValue,
  StringPattern,
} from './types.js'

/**
 * Re-export runtime pattern factories.
 */
export { patternFor, patternForSchema, patternForV1Schema } from './factories.js'
