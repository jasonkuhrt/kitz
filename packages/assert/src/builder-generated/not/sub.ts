import type { Fn } from '@kitz/core'
import type { AssertSubKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * base + sub relation matchers.
 *
 * Direct type assertion
 * Relation: subtype relation (extends)
 */

/**
 * Base matcher accepting any expected type.
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.of<string, string>
 *
 * // ✗ Fail
 * type _ = Assert.sub.of<string, number>
 * ```
 */
type of_<$Expected, $Actual> = Fn.Kind.Apply<AssertSubKind, [$Expected, $Actual, true]>
const of_ = builder.not.sub.of

/**
 * Pre-curried matcher for string.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.string<string>
 *
 * // ✗ Fail
 * type _ = Assert.sub.string<number>
 * ```
 */
type string_<$Actual> = Fn.Kind.Apply<AssertSubKind, [string, $Actual, true]>
const string_ = builder.not.sub.string

/**
 * Pre-curried matcher for number.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.number<number>
 *
 * // ✗ Fail
 * type _ = Assert.sub.number<string>
 * ```
 */
type number_<$Actual> = Fn.Kind.Apply<AssertSubKind, [number, $Actual, true]>
const number_ = builder.not.sub.number

/**
 * Pre-curried matcher for bigint.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.bigint<bigint>
 *
 * // ✗ Fail
 * type _ = Assert.sub.bigint<string>
 * ```
 */
type bigint_<$Actual> = Fn.Kind.Apply<AssertSubKind, [bigint, $Actual, true]>
const bigint_ = builder.not.sub.bigint

/**
 * Pre-curried matcher for boolean.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.boolean<boolean>
 *
 * // ✗ Fail
 * type _ = Assert.sub.boolean<string>
 * ```
 */
type boolean_<$Actual> = Fn.Kind.Apply<AssertSubKind, [boolean, $Actual, true]>
const boolean_ = builder.not.sub.boolean

/**
 * Pre-curried matcher for true.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.true<true>
 *
 * // ✗ Fail
 * type _ = Assert.sub.true<string>
 * ```
 */
type true_<$Actual> = Fn.Kind.Apply<AssertSubKind, [true, $Actual, true]>
const true_ = builder.not.sub.true

/**
 * Pre-curried matcher for false.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.false<false>
 *
 * // ✗ Fail
 * type _ = Assert.sub.false<string>
 * ```
 */
type false_<$Actual> = Fn.Kind.Apply<AssertSubKind, [false, $Actual, true]>
const false_ = builder.not.sub.false

/**
 * Pre-curried matcher for undefined.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.undefined<undefined>
 *
 * // ✗ Fail
 * type _ = Assert.sub.undefined<string>
 * ```
 */
type undefined_<$Actual> = Fn.Kind.Apply<AssertSubKind, [undefined, $Actual, true]>
const undefined_ = builder.not.sub.undefined

/**
 * Pre-curried matcher for null.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.null<null>
 *
 * // ✗ Fail
 * type _ = Assert.sub.null<string>
 * ```
 */
type null_<$Actual> = Fn.Kind.Apply<AssertSubKind, [null, $Actual, true]>
const null_ = builder.not.sub.null

/**
 * Pre-curried matcher for symbol.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.symbol<symbol>
 *
 * // ✗ Fail
 * type _ = Assert.sub.symbol<string>
 * ```
 */
type symbol_<$Actual> = Fn.Kind.Apply<AssertSubKind, [symbol, $Actual, true]>
const symbol_ = builder.not.sub.symbol

/**
 * Pre-curried matcher for Date.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.Date<Date>
 *
 * // ✗ Fail
 * type _ = Assert.sub.Date<string>
 * ```
 */
type Date_<$Actual> = Fn.Kind.Apply<AssertSubKind, [Date, $Actual, true]>
const Date_ = builder.not.sub.Date

/**
 * Pre-curried matcher for RegExp.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.RegExp<RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.sub.RegExp<string>
 * ```
 */
type RegExp_<$Actual> = Fn.Kind.Apply<AssertSubKind, [RegExp, $Actual, true]>
const RegExp_ = builder.not.sub.RegExp

/**
 * Pre-curried matcher for Error.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.Error<Error>
 *
 * // ✗ Fail
 * type _ = Assert.sub.Error<string>
 * ```
 */
type Error_<$Actual> = Fn.Kind.Apply<AssertSubKind, [Error, $Actual, true]>
const Error_ = builder.not.sub.Error

/**
 * Pre-curried matcher for unknown.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.unknown<unknown>
 *
 * // ✗ Fail
 * type _ = Assert.sub.unknown<string>
 * ```
 */
type unknown_<$Actual> = Fn.Kind.Apply<AssertSubKind, [unknown, $Actual, true]>
const unknown_ = builder.not.sub.unknown

/**
 * Pre-curried matcher for any.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.any<any>
 *
 * // ✗ Fail
 * type _ = Assert.sub.any<string>
 * ```
 */
type any_<$Actual> = Fn.Kind.Apply<AssertSubKind, [any, $Actual, true]>
const any_ = builder.not.sub.any

/**
 * Pre-curried matcher for never.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.sub.never<never>
 *
 * // ✗ Fail
 * type _ = Assert.sub.never<string>
 * ```
 */
type never_<$Actual> = Fn.Kind.Apply<AssertSubKind, [never, $Actual, true]>
const never_ = builder.not.sub.never

const ofAs_ = <$Type>() => builder.not.sub.ofAs<$Type>()

export {
  any_ as any,
  bigint_ as bigint,
  boolean_ as boolean,
  Date_ as Date,
  Error_ as Error,
  false_ as false,
  never_ as never,
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
