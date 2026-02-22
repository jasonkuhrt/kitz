import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertEquivKind, AssertEquivNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * array + equiv relation matchers.
 *
 * Extraction: extracts the element type from an array
 * Relation: mutual assignability (equivalent types)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: T[] → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `equiv<E, A>` instead of `equiv.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.of<string, string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.of<string, number[]>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.array.equiv.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.string<string[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.string<number[]>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [string, __actual__]>
                                                                         : never
const string_ = builder.array.equiv.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.number<number[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.number<string[]>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [number, __actual__]>
                                                                         : never
const number_ = builder.array.equiv.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.bigint<bigint[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.bigint<string[]>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.array.equiv.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.boolean<boolean[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.boolean<string[]>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.array.equiv.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.true<true[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.true<string[]>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [true, __actual__]>
                                                                         : never
const true_ = builder.array.equiv.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.false<false[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.false<string[]>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [false, __actual__]>
                                                                         : never
const false_ = builder.array.equiv.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.undefined<undefined[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.undefined<string[]>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.array.equiv.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.null<null[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.null<string[]>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [null, __actual__]>
                                                                         : never
const null_ = builder.array.equiv.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.symbol<symbol[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.symbol<string[]>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.array.equiv.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.Date<Date[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.Date<string[]>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.array.equiv.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.RegExp<RegExp[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.RegExp<string[]>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.array.equiv.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.Error<Error[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.Error<string[]>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.array.equiv.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.unknown<unknown[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.unknown<string[]>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.array.equiv.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.any<any[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.any<string[]>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [any, __actual__]>
                                                                         : never
const any_ = builder.array.equiv.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: T[] → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.array.equiv.never<never[]>
 *
 * // ✗ Fail
 * type _ = Assert.array.equiv.never<string[]>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [never, __actual__]>
                                                                         : never
const never_ = builder.array.equiv.never

const ofAs_ = <$Type>() => builder.array.equiv.ofAs<$Type>()
/**
 * No-excess variant of equiv relation.
 * Checks that actual has no excess properties beyond expected.
 */
// dprint-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_ = builder.array.equiv.noExcess
const noExcessAs_ = <$Type>() => builder.array.equiv.noExcessAs<$Type>()

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
