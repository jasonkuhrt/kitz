import type { Fn } from '@kitz/core'
import type { AssertEquivKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * base + equiv relation matchers.
 *
 * Direct type assertion
 * Relation: mutual assignability (equivalent types)
 */

/**
 * Base matcher accepting any expected type.
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `equiv<E, A>` instead of `equiv.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.of<string, string>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.of<string, number>
 * ```
 */
type of_<$Expected, $Actual> = Fn.Kind.Apply<AssertEquivKind, [$Expected, $Actual, true]>
const of_ = builder.not.equiv.of

/**
 * Pre-curried matcher for string.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.string<string>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.string<number>
 * ```
 */
type string_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [string, $Actual, true]>
const string_ = builder.not.equiv.string

/**
 * Pre-curried matcher for number.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.number<number>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.number<string>
 * ```
 */
type number_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [number, $Actual, true]>
const number_ = builder.not.equiv.number

/**
 * Pre-curried matcher for bigint.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.bigint<bigint>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.bigint<string>
 * ```
 */
type bigint_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [bigint, $Actual, true]>
const bigint_ = builder.not.equiv.bigint

/**
 * Pre-curried matcher for boolean.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.boolean<boolean>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.boolean<string>
 * ```
 */
type boolean_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [boolean, $Actual, true]>
const boolean_ = builder.not.equiv.boolean

/**
 * Pre-curried matcher for true.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.true<true>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.true<string>
 * ```
 */
type true_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [true, $Actual, true]>
const true_ = builder.not.equiv.true

/**
 * Pre-curried matcher for false.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.false<false>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.false<string>
 * ```
 */
type false_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [false, $Actual, true]>
const false_ = builder.not.equiv.false

/**
 * Pre-curried matcher for undefined.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.undefined<undefined>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.undefined<string>
 * ```
 */
type undefined_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [undefined, $Actual, true]>
const undefined_ = builder.not.equiv.undefined

/**
 * Pre-curried matcher for null.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.null<null>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.null<string>
 * ```
 */
type null_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [null, $Actual, true]>
const null_ = builder.not.equiv.null

/**
 * Pre-curried matcher for symbol.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.symbol<symbol>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.symbol<string>
 * ```
 */
type symbol_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [symbol, $Actual, true]>
const symbol_ = builder.not.equiv.symbol

/**
 * Pre-curried matcher for Date.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.Date<Date>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.Date<string>
 * ```
 */
type Date_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [Date, $Actual, true]>
const Date_ = builder.not.equiv.Date

/**
 * Pre-curried matcher for RegExp.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.RegExp<RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.RegExp<string>
 * ```
 */
type RegExp_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [RegExp, $Actual, true]>
const RegExp_ = builder.not.equiv.RegExp

/**
 * Pre-curried matcher for Error.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.Error<Error>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.Error<string>
 * ```
 */
type Error_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [Error, $Actual, true]>
const Error_ = builder.not.equiv.Error

/**
 * Pre-curried matcher for unknown.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.unknown<unknown>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.unknown<string>
 * ```
 */
type unknown_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [unknown, $Actual, true]>
const unknown_ = builder.not.equiv.unknown

/**
 * Pre-curried matcher for any.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.any<any>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.any<string>
 * ```
 */
type any_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [any, $Actual, true]>
const any_ = builder.not.equiv.any

/**
 * Pre-curried matcher for never.
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.equiv.never<never>
 *
 * // ✗ Fail
 * type _ = Assert.equiv.never<string>
 * ```
 */
type never_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [never, $Actual, true]>
const never_ = builder.not.equiv.never

const ofAs_ = <$Type>() => builder.not.equiv.ofAs<$Type>()

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
