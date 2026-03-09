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
const of_: typeof builder.sub.of = builder.sub.of

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
const string_: typeof builder.sub.string = builder.sub.string

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
const number_: typeof builder.sub.number = builder.sub.number

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
const bigint_: typeof builder.sub.bigint = builder.sub.bigint

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
const boolean_: typeof builder.sub.boolean = builder.sub.boolean

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
const true_: typeof builder.sub.true = builder.sub.true

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
const false_: typeof builder.sub.false = builder.sub.false

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
const undefined_: typeof builder.sub.undefined = builder.sub.undefined

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
const null_: typeof builder.sub.null = builder.sub.null

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
const symbol_: typeof builder.sub.symbol = builder.sub.symbol

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
const Date_: typeof builder.sub.Date = builder.sub.Date

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
const RegExp_: typeof builder.sub.RegExp = builder.sub.RegExp

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
const Error_: typeof builder.sub.Error = builder.sub.Error

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
const unknown_: typeof builder.sub.unknown = builder.sub.unknown

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
const any_: typeof builder.sub.any = builder.sub.any

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
const never_: typeof builder.sub.never = builder.sub.never

const ofAs_: typeof builder.sub.ofAs = builder.sub.ofAs
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
type noExcess_<$Expected, $Actual> = Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, $Actual]>
const noExcess_: typeof builder.sub.noExcess = builder.sub.noExcess
const noExcessAs_: typeof builder.sub.noExcessAs = builder.sub.noExcessAs

export {
  any_ as any,
  bigint_ as bigint,
  boolean_ as boolean,
  Date_ as Date,
  Error_ as Error,
  false_ as false,
  never_ as never,
  noExcess_ as noExcess,
  noExcessAs_ as noExcessAs,
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
