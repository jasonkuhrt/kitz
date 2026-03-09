import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

/**
 * parameter1 + sub relation matchers.
 *
 * Extraction: extracts the first parameter type from a function
 * Relation: subtype relation (extends)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.of<string, (arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.of<string, (arg: number) => any>
 * ```
 */
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.parameter1.not.sub.of = builder.parameter1.not.sub.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.string<(arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.string<(arg: number) => any>
 * ```
 */
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.parameter1.not.sub.string = builder.parameter1.not.sub.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.number<(arg: number) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.number<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.parameter1.not.sub.number = builder.parameter1.not.sub.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.bigint<(arg: bigint) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.bigint<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.parameter1.not.sub.bigint = builder.parameter1.not.sub.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.boolean<(arg: boolean) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.boolean<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.parameter1.not.sub.boolean = builder.parameter1.not.sub.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.true<(arg: true) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.true<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.parameter1.not.sub.true = builder.parameter1.not.sub.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.false<(arg: false) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.false<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.parameter1.not.sub.false = builder.parameter1.not.sub.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.undefined<(arg: undefined) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.undefined<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.parameter1.not.sub.undefined = builder.parameter1.not.sub.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.null<(arg: null) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.null<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.parameter1.not.sub.null = builder.parameter1.not.sub.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.symbol<(arg: symbol) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.symbol<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.parameter1.not.sub.symbol = builder.parameter1.not.sub.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.Date<(arg: Date) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.Date<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.parameter1.not.sub.Date = builder.parameter1.not.sub.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.RegExp<(arg: RegExp) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.RegExp<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.parameter1.not.sub.RegExp = builder.parameter1.not.sub.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.Error<(arg: Error) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.Error<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.parameter1.not.sub.Error = builder.parameter1.not.sub.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.unknown<(arg: unknown) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.unknown<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.parameter1.not.sub.unknown = builder.parameter1.not.sub.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.any<(arg: any) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.any<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.parameter1.not.sub.any = builder.parameter1.not.sub.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.sub.never<(arg: never) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.sub.never<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.parameter1.not.sub.never = builder.parameter1.not.sub.never

const ofAs_: typeof builder.parameter1.not.sub.ofAs = builder.parameter1.not.sub.ofAs

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
