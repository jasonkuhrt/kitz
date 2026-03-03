import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertEquivKind, AssertEquivNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * awaited + equiv relation matchers.
 *
 * Extraction: extracts the resolved type from a Promise
 * Relation: mutual assignability (equivalent types)
 */


/**
 * Base matcher accepting any expected type.
 * Extraction chain: Promise<T> → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `equiv<E, A>` instead of `equiv.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.of<string, Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.of<string, Promise<number>>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.awaited.equiv.of


/**
 * Pre-curried matcher for string.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.string<Promise<string>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.string<Promise<number>>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [string, __actual__]>
                                                                         : never
const string_ = builder.awaited.equiv.string


/**
 * Pre-curried matcher for number.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.number<Promise<number>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.number<Promise<string>>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [number, __actual__]>
                                                                         : never
const number_ = builder.awaited.equiv.number


/**
 * Pre-curried matcher for bigint.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.bigint<Promise<bigint>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.bigint<Promise<string>>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.awaited.equiv.bigint


/**
 * Pre-curried matcher for boolean.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.boolean<Promise<boolean>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.boolean<Promise<string>>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.awaited.equiv.boolean


/**
 * Pre-curried matcher for true.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.true<Promise<true>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.true<Promise<string>>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [true, __actual__]>
                                                                         : never
const true_ = builder.awaited.equiv.true


/**
 * Pre-curried matcher for false.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.false<Promise<false>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.false<Promise<string>>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [false, __actual__]>
                                                                         : never
const false_ = builder.awaited.equiv.false


/**
 * Pre-curried matcher for undefined.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.undefined<Promise<undefined>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.undefined<Promise<string>>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.awaited.equiv.undefined


/**
 * Pre-curried matcher for null.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.null<Promise<null>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.null<Promise<string>>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [null, __actual__]>
                                                                         : never
const null_ = builder.awaited.equiv.null


/**
 * Pre-curried matcher for symbol.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.symbol<Promise<symbol>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.symbol<Promise<string>>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.awaited.equiv.symbol


/**
 * Pre-curried matcher for Date.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.Date<Promise<Date>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.Date<Promise<string>>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.awaited.equiv.Date


/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.RegExp<Promise<RegExp>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.RegExp<Promise<string>>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.awaited.equiv.RegExp


/**
 * Pre-curried matcher for Error.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.Error<Promise<Error>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.Error<Promise<string>>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.awaited.equiv.Error


/**
 * Pre-curried matcher for unknown.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.unknown<Promise<unknown>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.unknown<Promise<string>>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.awaited.equiv.unknown


/**
 * Pre-curried matcher for any.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.any<Promise<any>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.any<Promise<string>>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [any, __actual__]>
                                                                         : never
const any_ = builder.awaited.equiv.any


/**
 * Pre-curried matcher for never.
 * Extraction chain: Promise<T> → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.awaited.equiv.never<Promise<never>>
 *
 * // ✗ Fail
 * type _ = Assert.awaited.equiv.never<Promise<string>>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [never, __actual__]>
                                                                         : never
const never_ = builder.awaited.equiv.never

const ofAs_ = <$Type>() => builder.awaited.equiv.ofAs<$Type>()
/**
 * No-excess variant of equiv relation.
 * Checks that actual has no excess properties beyond expected.
 */
// dprint-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_ = builder.awaited.equiv.noExcess
const noExcessAs_ = <$Type>() => builder.awaited.equiv.noExcessAs<$Type>()

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
