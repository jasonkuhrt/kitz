import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertExactKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

/**
 * parameters + exact relation matchers.
 *
 * Extraction: extracts the parameters tuple from a function
 * Relation: exact structural equality
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `exact<E, A>` instead of `exact.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.of<string, (...args: any[]) => string>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.of<string, (...args: any[]) => number>
 * ```
 */
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never
const of_: typeof builder.parameters.not.exact.of = builder.parameters.not.exact.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.string<(...args: any[]) => string>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.string<(...args: any[]) => number>
 * ```
 */
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [string, __actual__, true]>
                                                                         : never
const string_: typeof builder.parameters.not.exact.string = builder.parameters.not.exact.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.number<(...args: any[]) => number>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.number<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [number, __actual__, true]>
                                                                         : never
const number_: typeof builder.parameters.not.exact.number = builder.parameters.not.exact.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.bigint<(...args: any[]) => bigint>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.bigint<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [bigint, __actual__, true]>
                                                                         : never
const bigint_: typeof builder.parameters.not.exact.bigint = builder.parameters.not.exact.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.boolean<(...args: any[]) => boolean>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.boolean<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [boolean, __actual__, true]>
                                                                         : never
const boolean_: typeof builder.parameters.not.exact.boolean = builder.parameters.not.exact.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.true<(...args: any[]) => true>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.true<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [true, __actual__, true]>
                                                                         : never
const true_: typeof builder.parameters.not.exact.true = builder.parameters.not.exact.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.false<(...args: any[]) => false>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.false<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [false, __actual__, true]>
                                                                         : never
const false_: typeof builder.parameters.not.exact.false = builder.parameters.not.exact.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.undefined<(...args: any[]) => undefined>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.undefined<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [undefined, __actual__, true]>
                                                                         : never
const undefined_: typeof builder.parameters.not.exact.undefined =
  builder.parameters.not.exact.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.null<(...args: any[]) => null>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.null<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [null, __actual__, true]>
                                                                         : never
const null_: typeof builder.parameters.not.exact.null = builder.parameters.not.exact.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.symbol<(...args: any[]) => symbol>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.symbol<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [symbol, __actual__, true]>
                                                                         : never
const symbol_: typeof builder.parameters.not.exact.symbol = builder.parameters.not.exact.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.Date<(...args: any[]) => Date>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.Date<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [Date, __actual__, true]>
                                                                         : never
const Date_: typeof builder.parameters.not.exact.Date = builder.parameters.not.exact.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.RegExp<(...args: any[]) => RegExp>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.RegExp<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [RegExp, __actual__, true]>
                                                                         : never
const RegExp_: typeof builder.parameters.not.exact.RegExp = builder.parameters.not.exact.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.Error<(...args: any[]) => Error>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.Error<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [Error, __actual__, true]>
                                                                         : never
const Error_: typeof builder.parameters.not.exact.Error = builder.parameters.not.exact.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.unknown<(...args: any[]) => unknown>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.unknown<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [unknown, __actual__, true]>
                                                                         : never
const unknown_: typeof builder.parameters.not.exact.unknown = builder.parameters.not.exact.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.any<(...args: any[]) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.any<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [any, __actual__, true]>
                                                                         : never
const any_: typeof builder.parameters.not.exact.any = builder.parameters.not.exact.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (...args: any[]) => T → Parameters<Function>
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameters.exact.never<(...args: any[]) => never>
 *
 * // ✗ Fail
 * type _ = Assert.parameters.exact.never<(...args: any[]) => string>
 * ```
 */
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameters.Get<$Actual>> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [never, __actual__, true]>
                                                                         : never
const never_: typeof builder.parameters.not.exact.never = builder.parameters.not.exact.never

const ofAs_: typeof builder.parameters.not.exact.ofAs = builder.parameters.not.exact.ofAs
type noExcess_ = never
const noExcess_: typeof builder.parameters.not.exact.noExcess =
  builder.parameters.not.exact.noExcess

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
