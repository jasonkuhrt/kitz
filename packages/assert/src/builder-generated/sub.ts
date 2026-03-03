import type { Fn } from '@kitz/core'
import type { AssertSubKind, AssertSubNoExcessKind } from '../asserts.js'
import { builder } from '../builder-singleton.js'

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
type of_<$Expected, $Actual> = Fn.Kind.Apply<AssertSubKind, [$Expected, $Actual]>
const of_ = builder.sub.of


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
type string_<$Actual> = Fn.Kind.Apply<AssertSubKind, [string, $Actual]>
const string_ = builder.sub.string


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
type number_<$Actual> = Fn.Kind.Apply<AssertSubKind, [number, $Actual]>
const number_ = builder.sub.number


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
type bigint_<$Actual> = Fn.Kind.Apply<AssertSubKind, [bigint, $Actual]>
const bigint_ = builder.sub.bigint


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
type boolean_<$Actual> = Fn.Kind.Apply<AssertSubKind, [boolean, $Actual]>
const boolean_ = builder.sub.boolean


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
type true_<$Actual> = Fn.Kind.Apply<AssertSubKind, [true, $Actual]>
const true_ = builder.sub.true


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
type false_<$Actual> = Fn.Kind.Apply<AssertSubKind, [false, $Actual]>
const false_ = builder.sub.false


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
type undefined_<$Actual> = Fn.Kind.Apply<AssertSubKind, [undefined, $Actual]>
const undefined_ = builder.sub.undefined


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
type null_<$Actual> = Fn.Kind.Apply<AssertSubKind, [null, $Actual]>
const null_ = builder.sub.null


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
type symbol_<$Actual> = Fn.Kind.Apply<AssertSubKind, [symbol, $Actual]>
const symbol_ = builder.sub.symbol


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
type Date_<$Actual> = Fn.Kind.Apply<AssertSubKind, [Date, $Actual]>
const Date_ = builder.sub.Date


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
type RegExp_<$Actual> = Fn.Kind.Apply<AssertSubKind, [RegExp, $Actual]>
const RegExp_ = builder.sub.RegExp


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
type Error_<$Actual> = Fn.Kind.Apply<AssertSubKind, [Error, $Actual]>
const Error_ = builder.sub.Error


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
type unknown_<$Actual> = Fn.Kind.Apply<AssertSubKind, [unknown, $Actual]>
const unknown_ = builder.sub.unknown


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
type any_<$Actual> = Fn.Kind.Apply<AssertSubKind, [any, $Actual]>
const any_ = builder.sub.any


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
type never_<$Actual> = Fn.Kind.Apply<AssertSubKind, [never, $Actual]>
const never_ = builder.sub.never

const ofAs_ = <$Type>() => builder.sub.ofAs<$Type>()
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
type noExcess_<$Expected, $Actual> = Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, $Actual]>
const noExcess_ = builder.sub.noExcess
const noExcessAs_ = <$Type>() => builder.sub.noExcessAs<$Type>()

export {
  of_ as of,
  string_ as string,
  number_ as number,
  bigint_ as bigint,
  boolean_ as boolean,
  true_ as true,
  false_ as false,
  undefined_ as undefined,
  null_ as null,
  symbol_ as symbol,
  Date_ as Date,
  RegExp_ as RegExp,
  Error_ as Error,
  unknown_ as unknown,
  any_ as any,
  never_ as never,
  ofAs_ as ofAs,
  noExcess_ as noExcess,
  noExcessAs_ as noExcessAs,
}
