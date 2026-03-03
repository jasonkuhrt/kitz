import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * array + exact relation matchers.
 *
 * Extraction: extracts the element type from an array
 * Relation: exact structural equality
 */


/**
 * Base matcher accepting any expected type.
 * Extraction chain: T[] → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `exact<E, A>` instead of `exact.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.of<string, string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.of<string, number[]>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.array.exact.of


/**
 * Pre-curried matcher for string.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.string<string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.string<number[]>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__]>
                                                                         : never
const string_ = builder.array.exact.string


/**
 * Pre-curried matcher for number.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.number<number[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.number<string[]>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__]>
                                                                         : never
const number_ = builder.array.exact.number


/**
 * Pre-curried matcher for bigint.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.bigint<bigint[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.bigint<string[]>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.array.exact.bigint


/**
 * Pre-curried matcher for boolean.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.boolean<boolean[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.boolean<string[]>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.array.exact.boolean


/**
 * Pre-curried matcher for true.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.true<true[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.true<string[]>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__]>
                                                                         : never
const true_ = builder.array.exact.true


/**
 * Pre-curried matcher for false.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.false<false[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.false<string[]>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__]>
                                                                         : never
const false_ = builder.array.exact.false


/**
 * Pre-curried matcher for undefined.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.undefined<undefined[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.undefined<string[]>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.array.exact.undefined


/**
 * Pre-curried matcher for null.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.null<null[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.null<string[]>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__]>
                                                                         : never
const null_ = builder.array.exact.null


/**
 * Pre-curried matcher for symbol.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.symbol<symbol[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.symbol<string[]>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.array.exact.symbol


/**
 * Pre-curried matcher for Date.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.Date<Date[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.Date<string[]>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.array.exact.Date


/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.RegExp<RegExp[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.RegExp<string[]>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.array.exact.RegExp


/**
 * Pre-curried matcher for Error.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.Error<Error[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.Error<string[]>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.array.exact.Error


/**
 * Pre-curried matcher for unknown.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.unknown<unknown[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.unknown<string[]>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.array.exact.unknown


/**
 * Pre-curried matcher for any.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.any<any[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.any<string[]>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__]>
                                                                         : never
const any_ = builder.array.exact.any


/**
 * Pre-curried matcher for never.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.exact.never<never[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.exact.never<string[]>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__]>
                                                                         : never
const never_ = builder.array.exact.never

const ofAs_ = <$Type>() => builder.array.exact.ofAs<$Type>()
type noExcess_ = never
const noExcess_ = builder.array.exact.noExcess

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
}
