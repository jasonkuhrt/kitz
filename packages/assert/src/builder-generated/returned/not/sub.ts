import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

/**
 * returned + sub relation matchers.
 *
 * Extraction: extracts the return type from a function
 * Relation: subtype relation (extends)
 */


/**
 * Base matcher accepting any expected type.
 * Extraction chain: (...args: any[]) => T → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.of<string, () => string>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.of<string, () => number>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
const of_ = builder.returned.not.sub.of


/**
 * Pre-curried matcher for string.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.string<() => string>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.string<() => number>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__, true]>
                                                                         : never
const string_ = builder.returned.not.sub.string


/**
 * Pre-curried matcher for number.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.number<() => number>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.number<() => string>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__, true]>
                                                                         : never
const number_ = builder.returned.not.sub.number


/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.bigint<() => bigint>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.bigint<() => string>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_ = builder.returned.not.sub.bigint


/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.boolean<() => boolean>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.boolean<() => string>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_ = builder.returned.not.sub.boolean


/**
 * Pre-curried matcher for true.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.true<() => true>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.true<() => string>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__, true]>
                                                                         : never
const true_ = builder.returned.not.sub.true


/**
 * Pre-curried matcher for false.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.false<() => false>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.false<() => string>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__, true]>
                                                                         : never
const false_ = builder.returned.not.sub.false


/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.undefined<() => undefined>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.undefined<() => string>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_ = builder.returned.not.sub.undefined


/**
 * Pre-curried matcher for null.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.null<() => null>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.null<() => string>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__, true]>
                                                                         : never
const null_ = builder.returned.not.sub.null


/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.symbol<() => symbol>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.symbol<() => string>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_ = builder.returned.not.sub.symbol


/**
 * Pre-curried matcher for Date.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.Date<() => Date>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.Date<() => string>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__, true]>
                                                                         : never
const Date_ = builder.returned.not.sub.Date


/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.RegExp<() => RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.RegExp<() => string>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_ = builder.returned.not.sub.RegExp


/**
 * Pre-curried matcher for Error.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.Error<() => Error>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.Error<() => string>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__, true]>
                                                                         : never
const Error_ = builder.returned.not.sub.Error


/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.unknown<() => unknown>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.unknown<() => string>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_ = builder.returned.not.sub.unknown


/**
 * Pre-curried matcher for any.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.any<() => any>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.any<() => string>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__, true]>
                                                                         : never
const any_ = builder.returned.not.sub.any


/**
 * Pre-curried matcher for never.
 * Extraction chain: (...args: any[]) => T → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.returned.sub.never<() => never>
 *
 * // ✗ Fail
 * type _ = Assert.returned.sub.never<() => string>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Returned.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__, true]>
                                                                         : never
const never_ = builder.returned.not.sub.never

const ofAs_ = <$Type>() => builder.returned.not.sub.ofAs<$Type>()

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
