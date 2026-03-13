import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertExactKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

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
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.awaited.not.exact.of = builder.awaited.not.exact.of

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
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.awaited.not.exact.string = builder.awaited.not.exact.string

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
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.awaited.not.exact.number = builder.awaited.not.exact.number

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
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.awaited.not.exact.bigint = builder.awaited.not.exact.bigint

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
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.awaited.not.exact.boolean = builder.awaited.not.exact.boolean

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
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.awaited.not.exact.true = builder.awaited.not.exact.true

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
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.awaited.not.exact.false = builder.awaited.not.exact.false

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
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.awaited.not.exact.undefined = builder.awaited.not.exact.undefined

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
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.awaited.not.exact.null = builder.awaited.not.exact.null

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
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.awaited.not.exact.symbol = builder.awaited.not.exact.symbol

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
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.awaited.not.exact.Date = builder.awaited.not.exact.Date

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
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.awaited.not.exact.RegExp = builder.awaited.not.exact.RegExp

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
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.awaited.not.exact.Error = builder.awaited.not.exact.Error

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
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.awaited.not.exact.unknown = builder.awaited.not.exact.unknown

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
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.awaited.not.exact.any = builder.awaited.not.exact.any

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
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.awaited.not.exact.never = builder.awaited.not.exact.never

const ofAs_: typeof builder.awaited.not.exact.ofAs = builder.awaited.not.exact.ofAs
type noExcess_ = never
const noExcess_: typeof builder.awaited.not.exact.noExcess = builder.awaited.not.exact.noExcess

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
