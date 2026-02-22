import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * awaited + exact relation matchers.
 *
 * Extraction: extracts the resolved type from a Promise
 * Relation: exact structural equality
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: Promise<T> → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `exact<E, A>` instead of `exact.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.of<string, Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.of<string, Promise<number>>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.awaited.exact.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.string<Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.string<Promise<number>>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__]>
                                                                         : never
const string_ = builder.awaited.exact.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.number<Promise<number>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.number<Promise<string>>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__]>
                                                                         : never
const number_ = builder.awaited.exact.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.bigint<Promise<bigint>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.bigint<Promise<string>>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.awaited.exact.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.boolean<Promise<boolean>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.boolean<Promise<string>>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.awaited.exact.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.true<Promise<true>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.true<Promise<string>>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__]>
                                                                         : never
const true_ = builder.awaited.exact.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.false<Promise<false>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.false<Promise<string>>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__]>
                                                                         : never
const false_ = builder.awaited.exact.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.undefined<Promise<undefined>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.undefined<Promise<string>>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.awaited.exact.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.null<Promise<null>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.null<Promise<string>>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__]>
                                                                         : never
const null_ = builder.awaited.exact.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.symbol<Promise<symbol>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.symbol<Promise<string>>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.awaited.exact.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.Date<Promise<Date>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.Date<Promise<string>>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.awaited.exact.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.RegExp<Promise<RegExp>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.RegExp<Promise<string>>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.awaited.exact.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.Error<Promise<Error>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.Error<Promise<string>>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.awaited.exact.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.unknown<Promise<unknown>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.unknown<Promise<string>>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.awaited.exact.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.any<Promise<any>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.any<Promise<string>>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__]>
                                                                         : never
const any_ = builder.awaited.exact.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.exact.never<Promise<never>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.exact.never<Promise<string>>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__]>
                                                                         : never
const never_ = builder.awaited.exact.never

const ofAs_ = <$Type>() => builder.awaited.exact.ofAs<$Type>()
type noExcess_ = never
const noExcess_ = builder.awaited.exact.noExcess

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
