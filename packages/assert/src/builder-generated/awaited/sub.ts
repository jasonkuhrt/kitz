import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
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
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
const of_: typeof builder.awaited.sub.of = builder.awaited.sub.of

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
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__]>
                                                                         : never
const string_: typeof builder.awaited.sub.string = builder.awaited.sub.string

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
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__]>
                                                                         : never
const number_: typeof builder.awaited.sub.number = builder.awaited.sub.number

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
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__]>
                                                                         : never
const bigint_: typeof builder.awaited.sub.bigint = builder.awaited.sub.bigint

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
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__]>
                                                                         : never
const boolean_: typeof builder.awaited.sub.boolean = builder.awaited.sub.boolean

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
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__]>
                                                                         : never
const true_: typeof builder.awaited.sub.true = builder.awaited.sub.true

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
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__]>
                                                                         : never
const false_: typeof builder.awaited.sub.false = builder.awaited.sub.false

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
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__]>
                                                                         : never
const undefined_: typeof builder.awaited.sub.undefined = builder.awaited.sub.undefined

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
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__]>
                                                                         : never
const null_: typeof builder.awaited.sub.null = builder.awaited.sub.null

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
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__]>
                                                                         : never
const symbol_: typeof builder.awaited.sub.symbol = builder.awaited.sub.symbol

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
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__]>
                                                                         : never
const Date_: typeof builder.awaited.sub.Date = builder.awaited.sub.Date

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
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_: typeof builder.awaited.sub.RegExp = builder.awaited.sub.RegExp

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
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__]>
                                                                         : never
const Error_: typeof builder.awaited.sub.Error = builder.awaited.sub.Error

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
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__]>
                                                                         : never
const unknown_: typeof builder.awaited.sub.unknown = builder.awaited.sub.unknown

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
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__]>
                                                                         : never
const any_: typeof builder.awaited.sub.any = builder.awaited.sub.any

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
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__]>
                                                                         : never
const never_: typeof builder.awaited.sub.never = builder.awaited.sub.never

const ofAs_: typeof builder.awaited.sub.ofAs = builder.awaited.sub.ofAs
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
// oxfmt-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_: typeof builder.awaited.sub.noExcess = builder.awaited.sub.noExcess
const noExcessAs_: typeof builder.awaited.sub.noExcessAs = builder.awaited.sub.noExcessAs

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
