import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind, AssertSubNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * array + sub relation matchers.
 *
 * Extraction: extracts the element type from an array
 * Relation: subtype relation (extends)
 */


/**
 * Base matcher accepting any expected type.
 * Extraction chain: T[] → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.of<string, string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.of<string, number[]>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.array.sub.of


/**
 * Pre-curried matcher for string.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.string<string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.string<number[]>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__]>
                                                                         : never
const string_ = builder.array.sub.string


/**
 * Pre-curried matcher for number.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.number<number[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.number<string[]>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__]>
                                                                         : never
const number_ = builder.array.sub.number


/**
 * Pre-curried matcher for bigint.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.bigint<bigint[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.bigint<string[]>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.array.sub.bigint


/**
 * Pre-curried matcher for boolean.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.boolean<boolean[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.boolean<string[]>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.array.sub.boolean


/**
 * Pre-curried matcher for true.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.true<true[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.true<string[]>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__]>
                                                                         : never
const true_ = builder.array.sub.true


/**
 * Pre-curried matcher for false.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.false<false[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.false<string[]>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__]>
                                                                         : never
const false_ = builder.array.sub.false


/**
 * Pre-curried matcher for undefined.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.undefined<undefined[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.undefined<string[]>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.array.sub.undefined


/**
 * Pre-curried matcher for null.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.null<null[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.null<string[]>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__]>
                                                                         : never
const null_ = builder.array.sub.null


/**
 * Pre-curried matcher for symbol.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.symbol<symbol[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.symbol<string[]>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.array.sub.symbol


/**
 * Pre-curried matcher for Date.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.Date<Date[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.Date<string[]>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.array.sub.Date


/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.RegExp<RegExp[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.RegExp<string[]>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.array.sub.RegExp


/**
 * Pre-curried matcher for Error.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.Error<Error[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.Error<string[]>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.array.sub.Error


/**
 * Pre-curried matcher for unknown.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.unknown<unknown[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.unknown<string[]>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.array.sub.unknown


/**
 * Pre-curried matcher for any.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.any<any[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.any<string[]>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__]>
                                                                         : never
const any_ = builder.array.sub.any


/**
 * Pre-curried matcher for never.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.sub.never<never[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.sub.never<string[]>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__]>
                                                                         : never
const never_ = builder.array.sub.never

const ofAs_ = <$Type>() => builder.array.sub.ofAs<$Type>()
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
// dprint-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_ = builder.array.sub.noExcess
const noExcessAs_ = <$Type>() => builder.array.sub.noExcessAs<$Type>()

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
