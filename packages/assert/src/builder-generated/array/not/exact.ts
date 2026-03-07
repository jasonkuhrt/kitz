import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

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
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.array.not.exact.of = builder.array.not.exact.of

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
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.array.not.exact.string = builder.array.not.exact.string

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
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.array.not.exact.number = builder.array.not.exact.number

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
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.array.not.exact.bigint = builder.array.not.exact.bigint

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
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.array.not.exact.boolean = builder.array.not.exact.boolean

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
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.array.not.exact.true = builder.array.not.exact.true

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
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.array.not.exact.false = builder.array.not.exact.false

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
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.array.not.exact.undefined = builder.array.not.exact.undefined

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
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.array.not.exact.null = builder.array.not.exact.null

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
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.array.not.exact.symbol = builder.array.not.exact.symbol

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
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.array.not.exact.Date = builder.array.not.exact.Date

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
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.array.not.exact.RegExp = builder.array.not.exact.RegExp

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
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.array.not.exact.Error = builder.array.not.exact.Error

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
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.array.not.exact.unknown = builder.array.not.exact.unknown

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
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.array.not.exact.any = builder.array.not.exact.any

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
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.array.not.exact.never = builder.array.not.exact.never

const ofAs_: typeof builder.array.not.exact.ofAs = builder.array.not.exact.ofAs
type noExcess_ = never
const noExcess_: typeof builder.array.not.exact.noExcess = builder.array.not.exact.noExcess

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
