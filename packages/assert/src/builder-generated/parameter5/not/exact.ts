import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

/**
 * parameter5 + exact relation matchers.
 *
 * Extraction: extracts the fifth parameter type from a function
 * Relation: exact structural equality
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `exact<E, A>` instead of `exact.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.of<string, (arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.of<string, (arg: number) => any>
 * ```
 */
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.parameter5.not.exact.of = builder.parameter5.not.exact.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.string<(arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.string<(arg: number) => any>
 * ```
 */
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.parameter5.not.exact.string = builder.parameter5.not.exact.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.number<(arg: number) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.number<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.parameter5.not.exact.number = builder.parameter5.not.exact.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.bigint<(arg: bigint) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.bigint<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.parameter5.not.exact.bigint = builder.parameter5.not.exact.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.boolean<(arg: boolean) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.boolean<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.parameter5.not.exact.boolean = builder.parameter5.not.exact.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.true<(arg: true) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.true<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.parameter5.not.exact.true = builder.parameter5.not.exact.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.false<(arg: false) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.false<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.parameter5.not.exact.false = builder.parameter5.not.exact.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.undefined<(arg: undefined) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.undefined<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.parameter5.not.exact.undefined =
  builder.parameter5.not.exact.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.null<(arg: null) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.null<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.parameter5.not.exact.null = builder.parameter5.not.exact.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.symbol<(arg: symbol) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.symbol<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.parameter5.not.exact.symbol = builder.parameter5.not.exact.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.Date<(arg: Date) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.Date<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.parameter5.not.exact.Date = builder.parameter5.not.exact.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.RegExp<(arg: RegExp) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.RegExp<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.parameter5.not.exact.RegExp = builder.parameter5.not.exact.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.Error<(arg: Error) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.Error<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.parameter5.not.exact.Error = builder.parameter5.not.exact.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.unknown<(arg: unknown) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.unknown<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.parameter5.not.exact.unknown = builder.parameter5.not.exact.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.any<(arg: any) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.any<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.parameter5.not.exact.any = builder.parameter5.not.exact.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (p1: any, p2: any, p3: any, p4: any, p5: T) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter5.exact.never<(arg: never) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter5.exact.never<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter5.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.parameter5.not.exact.never = builder.parameter5.not.exact.never

const ofAs_: typeof builder.parameter5.not.exact.ofAs = builder.parameter5.not.exact.ofAs
type noExcess_ = never
const noExcess_: typeof builder.parameter5.not.exact.noExcess =
  builder.parameter5.not.exact.noExcess

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
