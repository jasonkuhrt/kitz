import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

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
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
const of_ = builder.parameter3.not.sub.of


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
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__, true]>
                                                                         : never
const string_ = builder.parameter3.not.sub.string


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
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__, true]>
                                                                         : never
const number_ = builder.parameter3.not.sub.number


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
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_ = builder.parameter3.not.sub.bigint


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
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_ = builder.parameter3.not.sub.boolean


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
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__, true]>
                                                                         : never
const true_ = builder.parameter3.not.sub.true


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
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__, true]>
                                                                         : never
const false_ = builder.parameter3.not.sub.false


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
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_ = builder.parameter3.not.sub.undefined


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
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__, true]>
                                                                         : never
const null_ = builder.parameter3.not.sub.null


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
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_ = builder.parameter3.not.sub.symbol


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
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__, true]>
                                                                         : never
const Date_ = builder.parameter3.not.sub.Date


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
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_ = builder.parameter3.not.sub.RegExp


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
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__, true]>
                                                                         : never
const Error_ = builder.parameter3.not.sub.Error


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
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_ = builder.parameter3.not.sub.unknown


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
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__, true]>
                                                                         : never
const any_ = builder.parameter3.not.sub.any


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
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter3.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__, true]>
                                                                         : never
const never_ = builder.parameter3.not.sub.never

const ofAs_ = <$Type>() => builder.parameter3.not.sub.ofAs<$Type>()

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
}
