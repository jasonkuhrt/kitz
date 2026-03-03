import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind, AssertSubNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * awaited + sub relation matchers.
 *
 * Extraction: extracts the resolved type from a Promise
 * Relation: subtype relation (extends)
 */


/**
 * Base matcher accepting any expected type.
 * Extraction chain: Promise<T> → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.of<string, Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.of<string, Promise<number>>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.awaited.sub.of


/**
 * Pre-curried matcher for string.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.string<Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.string<Promise<number>>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__]>
                                                                         : never
const string_ = builder.awaited.sub.string


/**
 * Pre-curried matcher for number.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.number<Promise<number>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.number<Promise<string>>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__]>
                                                                         : never
const number_ = builder.awaited.sub.number


/**
 * Pre-curried matcher for bigint.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.bigint<Promise<bigint>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.bigint<Promise<string>>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.awaited.sub.bigint


/**
 * Pre-curried matcher for boolean.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.boolean<Promise<boolean>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.boolean<Promise<string>>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.awaited.sub.boolean


/**
 * Pre-curried matcher for true.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.true<Promise<true>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.true<Promise<string>>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__]>
                                                                         : never
const true_ = builder.awaited.sub.true


/**
 * Pre-curried matcher for false.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.false<Promise<false>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.false<Promise<string>>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__]>
                                                                         : never
const false_ = builder.awaited.sub.false


/**
 * Pre-curried matcher for undefined.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.undefined<Promise<undefined>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.undefined<Promise<string>>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.awaited.sub.undefined


/**
 * Pre-curried matcher for null.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.null<Promise<null>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.null<Promise<string>>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__]>
                                                                         : never
const null_ = builder.awaited.sub.null


/**
 * Pre-curried matcher for symbol.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.symbol<Promise<symbol>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.symbol<Promise<string>>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.awaited.sub.symbol


/**
 * Pre-curried matcher for Date.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.Date<Promise<Date>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.Date<Promise<string>>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.awaited.sub.Date


/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.RegExp<Promise<RegExp>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.RegExp<Promise<string>>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.awaited.sub.RegExp


/**
 * Pre-curried matcher for Error.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.Error<Promise<Error>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.Error<Promise<string>>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.awaited.sub.Error


/**
 * Pre-curried matcher for unknown.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.unknown<Promise<unknown>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.unknown<Promise<string>>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.awaited.sub.unknown


/**
 * Pre-curried matcher for any.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.any<Promise<any>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.any<Promise<string>>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__]>
                                                                         : never
const any_ = builder.awaited.sub.any


/**
 * Pre-curried matcher for never.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.sub.never<Promise<never>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.sub.never<Promise<string>>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__]>
                                                                         : never
const never_ = builder.awaited.sub.never

const ofAs_ = <$Type>() => builder.awaited.sub.ofAs<$Type>()
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
// dprint-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_ = builder.awaited.sub.noExcess
const noExcessAs_ = <$Type>() => builder.awaited.sub.noExcessAs<$Type>()

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
