import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertEquivKind, AssertEquivNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * parameter2 + equiv relation matchers.
 *
 * Extraction: extracts the second parameter type from a function
 * Relation: mutual assignability (equivalent types)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `equiv<E, A>` instead of `equiv.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.of<string, (arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.of<string, (arg: number) => any>
 * ```
 */
// dprint-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never
const of_ = builder.parameter2.equiv.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.string<(arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.string<(arg: number) => any>
 * ```
 */
// dprint-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [string, __actual__]>
                                                                         : never
const string_ = builder.parameter2.equiv.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.number<(arg: number) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.number<(arg: string) => any>
 * ```
 */
// dprint-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [number, __actual__]>
                                                                         : never
const number_ = builder.parameter2.equiv.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.bigint<(arg: bigint) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.bigint<(arg: string) => any>
 * ```
 */
// dprint-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [bigint, __actual__]>
                                                                         : never
const bigint_ = builder.parameter2.equiv.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.boolean<(arg: boolean) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.boolean<(arg: string) => any>
 * ```
 */
// dprint-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [boolean, __actual__]>
                                                                         : never
const boolean_ = builder.parameter2.equiv.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.true<(arg: true) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.true<(arg: string) => any>
 * ```
 */
// dprint-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [true, __actual__]>
                                                                         : never
const true_ = builder.parameter2.equiv.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.false<(arg: false) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.false<(arg: string) => any>
 * ```
 */
// dprint-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [false, __actual__]>
                                                                         : never
const false_ = builder.parameter2.equiv.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.undefined<(arg: undefined) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.undefined<(arg: string) => any>
 * ```
 */
// dprint-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [undefined, __actual__]>
                                                                         : never
const undefined_ = builder.parameter2.equiv.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.null<(arg: null) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.null<(arg: string) => any>
 * ```
 */
// dprint-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [null, __actual__]>
                                                                         : never
const null_ = builder.parameter2.equiv.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.symbol<(arg: symbol) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.symbol<(arg: string) => any>
 * ```
 */
// dprint-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [symbol, __actual__]>
                                                                         : never
const symbol_ = builder.parameter2.equiv.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.Date<(arg: Date) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.Date<(arg: string) => any>
 * ```
 */
// dprint-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Date, __actual__]>
                                                                         : never
const Date_ = builder.parameter2.equiv.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.RegExp<(arg: RegExp) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.RegExp<(arg: string) => any>
 * ```
 */
// dprint-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_ = builder.parameter2.equiv.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.Error<(arg: Error) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.Error<(arg: string) => any>
 * ```
 */
// dprint-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Error, __actual__]>
                                                                         : never
const Error_ = builder.parameter2.equiv.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.unknown<(arg: unknown) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.unknown<(arg: string) => any>
 * ```
 */
// dprint-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [unknown, __actual__]>
                                                                         : never
const unknown_ = builder.parameter2.equiv.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.any<(arg: any) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.any<(arg: string) => any>
 * ```
 */
// dprint-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [any, __actual__]>
                                                                         : never
const any_ = builder.parameter2.equiv.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (p1: any, p2: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter2.equiv.never<(arg: never) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter2.equiv.never<(arg: string) => any>
 * ```
 */
// dprint-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter2.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [never, __actual__]>
                                                                         : never
const never_ = builder.parameter2.equiv.never

const ofAs_ = <$Type>() => builder.parameter2.equiv.ofAs<$Type>()
/**
 * No-excess variant of equiv relation.
 * Checks that actual has no excess properties beyond expected.
 */
// dprint-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter2.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_ = builder.parameter2.equiv.noExcess
const noExcessAs_ = <$Type>() => builder.parameter2.equiv.noExcessAs<$Type>()

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
