import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertSubKind, AssertSubNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * parameter3 + sub relation matchers.
 *
 * Extraction: extracts the third parameter type from a function
 * Relation: subtype relation (extends)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.of<string, (arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.of<string, (arg: number) => any>
 * ```
 */
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
const of_: typeof builder.parameter3.sub.of = builder.parameter3.sub.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.string<(arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.string<(arg: number) => any>
 * ```
 */
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__]>
                                                                         : never
const string_: typeof builder.parameter3.sub.string = builder.parameter3.sub.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.number<(arg: number) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.number<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__]>
                                                                         : never
const number_: typeof builder.parameter3.sub.number = builder.parameter3.sub.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.bigint<(arg: bigint) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.bigint<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__]>
                                                                         : never
const bigint_: typeof builder.parameter3.sub.bigint = builder.parameter3.sub.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.boolean<(arg: boolean) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.boolean<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__]>
                                                                         : never
const boolean_: typeof builder.parameter3.sub.boolean = builder.parameter3.sub.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.true<(arg: true) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.true<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__]>
                                                                         : never
const true_: typeof builder.parameter3.sub.true = builder.parameter3.sub.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.false<(arg: false) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.false<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__]>
                                                                         : never
const false_: typeof builder.parameter3.sub.false = builder.parameter3.sub.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.undefined<(arg: undefined) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.undefined<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__]>
                                                                         : never
const undefined_: typeof builder.parameter3.sub.undefined = builder.parameter3.sub.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.null<(arg: null) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.null<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__]>
                                                                         : never
const null_: typeof builder.parameter3.sub.null = builder.parameter3.sub.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.symbol<(arg: symbol) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.symbol<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__]>
                                                                         : never
const symbol_: typeof builder.parameter3.sub.symbol = builder.parameter3.sub.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.Date<(arg: Date) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.Date<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__]>
                                                                         : never
const Date_: typeof builder.parameter3.sub.Date = builder.parameter3.sub.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.RegExp<(arg: RegExp) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.RegExp<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_: typeof builder.parameter3.sub.RegExp = builder.parameter3.sub.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.Error<(arg: Error) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.Error<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__]>
                                                                         : never
const Error_: typeof builder.parameter3.sub.Error = builder.parameter3.sub.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.unknown<(arg: unknown) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.unknown<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__]>
                                                                         : never
const unknown_: typeof builder.parameter3.sub.unknown = builder.parameter3.sub.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.any<(arg: any) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.any<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__]>
                                                                         : never
const any_: typeof builder.parameter3.sub.any = builder.parameter3.sub.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (p1: any, p2: any, p3: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter3.sub.never<(arg: never) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter3.sub.never<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__]>
                                                                         : never
const never_: typeof builder.parameter3.sub.never = builder.parameter3.sub.never

const ofAs_: typeof builder.parameter3.sub.ofAs = builder.parameter3.sub.ofAs
/**
 * No-excess variant of sub relation.
 * Checks that actual has no excess properties beyond expected.
 */
// oxfmt-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_: typeof builder.parameter3.sub.noExcess = builder.parameter3.sub.noExcess
const noExcessAs_: typeof builder.parameter3.sub.noExcessAs = builder.parameter3.sub.noExcessAs

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
