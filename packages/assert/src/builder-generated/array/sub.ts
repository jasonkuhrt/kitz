import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
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
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
const of_: typeof builder.array.sub.of = builder.array.sub.of

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
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__]>
                                                                         : never
const string_: typeof builder.array.sub.string = builder.array.sub.string

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
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__]>
                                                                         : never
const number_: typeof builder.array.sub.number = builder.array.sub.number

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
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__]>
                                                                         : never
const bigint_: typeof builder.array.sub.bigint = builder.array.sub.bigint

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
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__]>
                                                                         : never
const boolean_: typeof builder.array.sub.boolean = builder.array.sub.boolean

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
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__]>
                                                                         : never
const true_: typeof builder.array.sub.true = builder.array.sub.true

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
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__]>
                                                                         : never
const false_: typeof builder.array.sub.false = builder.array.sub.false

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
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__]>
                                                                         : never
const undefined_: typeof builder.array.sub.undefined = builder.array.sub.undefined

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
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__]>
                                                                         : never
const null_: typeof builder.array.sub.null = builder.array.sub.null

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
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__]>
                                                                         : never
const symbol_: typeof builder.array.sub.symbol = builder.array.sub.symbol

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
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__]>
                                                                         : never
const Date_: typeof builder.array.sub.Date = builder.array.sub.Date

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
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_: typeof builder.array.sub.RegExp = builder.array.sub.RegExp

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
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__]>
                                                                         : never
const Error_: typeof builder.array.sub.Error = builder.array.sub.Error

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
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__]>
                                                                         : never
const unknown_: typeof builder.array.sub.unknown = builder.array.sub.unknown

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
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__]>
                                                                         : never
const any_: typeof builder.array.sub.any = builder.array.sub.any

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
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Array.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__]>
                                                                         : never
const never_: typeof builder.array.sub.never = builder.array.sub.never

const ofAs_: typeof builder.array.sub.ofAs = builder.array.sub.ofAs
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
// oxfmt-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_: typeof builder.array.sub.noExcess = builder.array.sub.noExcess
const noExcessAs_: typeof builder.array.sub.noExcessAs = builder.array.sub.noExcessAs

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
