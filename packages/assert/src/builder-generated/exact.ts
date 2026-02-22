import type { Fn } from '@kitz/core'
import type { AssertExactKind } from '../asserts.js'
import { builder } from '../builder-singleton.js'

/**
 * base + exact relation matchers.
 *
 * Direct type assertion
 * Relation: exact structural equality
 */

/**
 * Base matcher accepting any expected type.
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `exact<E, A>` instead of `exact.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.of<string, string>
 *
 * // ✗ Fail
 * type _ = Assert.exact.of<string, number>
 * ```
 */
type of_<$Expected, $Actual> = Fn.Kind.Apply<AssertExactKind, [$Expected, $Actual]>
const of_ = builder.exact.of

/**
 * Pre-curried matcher for string.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.string<string>
 *
 * // ✗ Fail
 * type _ = Assert.exact.string<number>
 * ```
 */
type string_<$Actual> = Fn.Kind.Apply<AssertExactKind, [string, $Actual]>
const string_ = builder.exact.string

/**
 * Pre-curried matcher for number.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.number<number>
 *
 * // ✗ Fail
 * type _ = Assert.exact.number<string>
 * ```
 */
type number_<$Actual> = Fn.Kind.Apply<AssertExactKind, [number, $Actual]>
const number_ = builder.exact.number

/**
 * Pre-curried matcher for bigint.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.bigint<bigint>
 *
 * // ✗ Fail
 * type _ = Assert.exact.bigint<string>
 * ```
 */
type bigint_<$Actual> = Fn.Kind.Apply<AssertExactKind, [bigint, $Actual]>
const bigint_ = builder.exact.bigint

/**
 * Pre-curried matcher for boolean.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.boolean<boolean>
 *
 * // ✗ Fail
 * type _ = Assert.exact.boolean<string>
 * ```
 */
type boolean_<$Actual> = Fn.Kind.Apply<AssertExactKind, [boolean, $Actual]>
const boolean_ = builder.exact.boolean

/**
 * Pre-curried matcher for true.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.true<true>
 *
 * // ✗ Fail
 * type _ = Assert.exact.true<string>
 * ```
 */
type true_<$Actual> = Fn.Kind.Apply<AssertExactKind, [true, $Actual]>
const true_ = builder.exact.true

/**
 * Pre-curried matcher for false.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.false<false>
 *
 * // ✗ Fail
 * type _ = Assert.exact.false<string>
 * ```
 */
type false_<$Actual> = Fn.Kind.Apply<AssertExactKind, [false, $Actual]>
const false_ = builder.exact.false

/**
 * Pre-curried matcher for undefined.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.undefined<undefined>
 *
 * // ✗ Fail
 * type _ = Assert.exact.undefined<string>
 * ```
 */
type undefined_<$Actual> = Fn.Kind.Apply<AssertExactKind, [undefined, $Actual]>
const undefined_ = builder.exact.undefined

/**
 * Pre-curried matcher for null.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.null<null>
 *
 * // ✗ Fail
 * type _ = Assert.exact.null<string>
 * ```
 */
type null_<$Actual> = Fn.Kind.Apply<AssertExactKind, [null, $Actual]>
const null_ = builder.exact.null

/**
 * Pre-curried matcher for symbol.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.symbol<symbol>
 *
 * // ✗ Fail
 * type _ = Assert.exact.symbol<string>
 * ```
 */
type symbol_<$Actual> = Fn.Kind.Apply<AssertExactKind, [symbol, $Actual]>
const symbol_ = builder.exact.symbol

/**
 * Pre-curried matcher for Date.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.Date<Date>
 *
 * // ✗ Fail
 * type _ = Assert.exact.Date<string>
 * ```
 */
type Date_<$Actual> = Fn.Kind.Apply<AssertExactKind, [Date, $Actual]>
const Date_ = builder.exact.Date

/**
 * Pre-curried matcher for RegExp.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.RegExp<RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.exact.RegExp<string>
 * ```
 */
type RegExp_<$Actual> = Fn.Kind.Apply<AssertExactKind, [RegExp, $Actual]>
const RegExp_ = builder.exact.RegExp

/**
 * Pre-curried matcher for Error.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.Error<Error>
 *
 * // ✗ Fail
 * type _ = Assert.exact.Error<string>
 * ```
 */
type Error_<$Actual> = Fn.Kind.Apply<AssertExactKind, [Error, $Actual]>
const Error_ = builder.exact.Error

/**
 * Pre-curried matcher for unknown.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.unknown<unknown>
 *
 * // ✗ Fail
 * type _ = Assert.exact.unknown<string>
 * ```
 */
type unknown_<$Actual> = Fn.Kind.Apply<AssertExactKind, [unknown, $Actual]>
const unknown_ = builder.exact.unknown

/**
 * Pre-curried matcher for any.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.any<any>
 *
 * // ✗ Fail
 * type _ = Assert.exact.any<string>
 * ```
 */
type any_<$Actual> = Fn.Kind.Apply<AssertExactKind, [any, $Actual]>
const any_ = builder.exact.any

/**
 * Pre-curried matcher for never.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.exact.never<never>
 *
 * // ✗ Fail
 * type _ = Assert.exact.never<string>
 * ```
 */
type never_<$Actual> = Fn.Kind.Apply<AssertExactKind, [never, $Actual]>
const never_ = builder.exact.never

const ofAs_ = <$Type>() => builder.exact.ofAs<$Type>()
type noExcess_ = never
const noExcess_ = builder.exact.noExcess

export {
  any_ as any,
  bigint_ as bigint,
  boolean_ as boolean,
  Date_ as Date,
  Error_ as Error,
  false_ as false,
  never_ as never,
  noExcess_ as noExcess,
  null_ as null,
  number_ as number,
  of_ as of,
  ofAs_ as ofAs,
  RegExp_ as RegExp,
  string_ as string,
  symbol_ as symbol,
  true_ as true,
  undefined_ as undefined,
  unknown_ as unknown,
}
