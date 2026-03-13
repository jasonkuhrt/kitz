import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertEquivKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

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
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.awaited.not.equiv.of = builder.awaited.not.equiv.of

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
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.awaited.not.equiv.string = builder.awaited.not.equiv.string

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
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.awaited.not.equiv.number = builder.awaited.not.equiv.number

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
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.awaited.not.equiv.bigint = builder.awaited.not.equiv.bigint

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
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.awaited.not.equiv.boolean = builder.awaited.not.equiv.boolean

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
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.awaited.not.equiv.true = builder.awaited.not.equiv.true

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
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.awaited.not.equiv.false = builder.awaited.not.equiv.false

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
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.awaited.not.equiv.undefined = builder.awaited.not.equiv.undefined

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
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.awaited.not.equiv.null = builder.awaited.not.equiv.null

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
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.awaited.not.equiv.symbol = builder.awaited.not.equiv.symbol

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
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.awaited.not.equiv.Date = builder.awaited.not.equiv.Date

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
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.awaited.not.equiv.RegExp = builder.awaited.not.equiv.RegExp

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
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.awaited.not.equiv.Error = builder.awaited.not.equiv.Error

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
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.awaited.not.equiv.unknown = builder.awaited.not.equiv.unknown

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
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.awaited.not.equiv.any = builder.awaited.not.equiv.any

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
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Awaited.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.awaited.not.equiv.never = builder.awaited.not.equiv.never

const ofAs_: typeof builder.awaited.not.equiv.ofAs = builder.awaited.not.equiv.ofAs

export {
  any_ as any,
  bigint_ as bigint,
  boolean_ as boolean,
  Date_ as Date,
  Error_ as Error,
  false_ as false,
  never_ as never,
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
