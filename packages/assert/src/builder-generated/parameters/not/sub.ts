import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertSubKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

/**
 * parameters + sub relation matchers.
 *
 * Extraction: extracts the parameters tuple from a function
 * Relation: subtype relation (extends)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `sub<E, A>` instead of `sub.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.of<string, (...args: any[]) => string>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.of<string, (...args: any[]) => number>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
const of_ = builder.parameters.not.sub.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.string<(...args: any[]) => string>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.string<(...args: any[]) => number>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [string, __actual__, true]>
                                                                         : never
const string_ = builder.parameters.not.sub.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.number<(...args: any[]) => number>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.number<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [number, __actual__, true]>
                                                                         : never
const number_ = builder.parameters.not.sub.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.bigint<(...args: any[]) => bigint>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.bigint<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_ = builder.parameters.not.sub.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.boolean<(...args: any[]) => boolean>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.boolean<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_ = builder.parameters.not.sub.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.true<(...args: any[]) => true>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.true<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [true, __actual__, true]>
                                                                         : never
const true_ = builder.parameters.not.sub.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.false<(...args: any[]) => false>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.false<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [false, __actual__, true]>
                                                                         : never
const false_ = builder.parameters.not.sub.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.undefined<(...args: any[]) => undefined>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.undefined<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_ = builder.parameters.not.sub.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.null<(...args: any[]) => null>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.null<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [null, __actual__, true]>
                                                                         : never
const null_ = builder.parameters.not.sub.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.symbol<(...args: any[]) => symbol>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.symbol<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_ = builder.parameters.not.sub.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.Date<(...args: any[]) => Date>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.Date<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Date, __actual__, true]>
                                                                         : never
const Date_ = builder.parameters.not.sub.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.RegExp<(...args: any[]) => RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.RegExp<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_ = builder.parameters.not.sub.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.Error<(...args: any[]) => Error>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.Error<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [Error, __actual__, true]>
                                                                         : never
const Error_ = builder.parameters.not.sub.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.unknown<(...args: any[]) => unknown>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.unknown<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_ = builder.parameters.not.sub.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.any<(...args: any[]) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.any<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [any, __actual__, true]>
                                                                         : never
const any_ = builder.parameters.not.sub.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.sub.never<(...args: any[]) => never>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.sub.never<(...args: any[]) => string>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [never, __actual__, true]>
                                                                         : never
const never_ = builder.parameters.not.sub.never

const ofAs_ = <$Type>() => builder.parameters.not.sub.ofAs<$Type>()

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
