import type { Fn } from '@kitz/core'
import type { AssertEquivKind, AssertEquivNoExcessKind } from '../asserts.js'
import { builder } from '../builder-singleton.js'

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
type of_<$Expected, $Actual> = Fn.Kind.Apply<AssertEquivKind, [$Expected, $Actual]>
const of_ = builder.equiv.of


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
type string_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [string, $Actual]>
const string_ = builder.equiv.string


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
type number_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [number, $Actual]>
const number_ = builder.equiv.number


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
type bigint_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [bigint, $Actual]>
const bigint_ = builder.equiv.bigint


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
type boolean_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [boolean, $Actual]>
const boolean_ = builder.equiv.boolean


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
type true_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [true, $Actual]>
const true_ = builder.equiv.true


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
type false_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [false, $Actual]>
const false_ = builder.equiv.false


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
type undefined_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [undefined, $Actual]>
const undefined_ = builder.equiv.undefined


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
type null_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [null, $Actual]>
const null_ = builder.equiv.null


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
type symbol_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [symbol, $Actual]>
const symbol_ = builder.equiv.symbol


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
type Date_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [Date, $Actual]>
const Date_ = builder.equiv.Date


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
type RegExp_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [RegExp, $Actual]>
const RegExp_ = builder.equiv.RegExp


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
type Error_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [Error, $Actual]>
const Error_ = builder.equiv.Error


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
type unknown_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [unknown, $Actual]>
const unknown_ = builder.equiv.unknown


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
type any_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [any, $Actual]>
const any_ = builder.equiv.any


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
type never_<$Actual> = Fn.Kind.Apply<AssertEquivKind, [never, $Actual]>
const never_ = builder.equiv.never

const ofAs_ = <$Type>() => builder.equiv.ofAs<$Type>()
/**
 * No-excess variant of equiv relation.
 * Checks that actual has no excess properties beyond expected.
 */
type noExcess_<$Expected, $Actual> = Fn.Kind.Apply<AssertEquivNoExcessKind, [$Expected, $Actual]>
const noExcess_ = builder.equiv.noExcess
const noExcessAs_ = <$Type>() => builder.equiv.noExcessAs<$Type>()

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
