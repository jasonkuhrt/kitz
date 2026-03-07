import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertEquivKind, AssertEquivNoExcessKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

/**
 * parameter1 + equiv relation matchers.
 *
 * Extraction: extracts the first parameter type from a function
 * Relation: mutual assignability (equivalent types)
 */

/**
 * Base matcher accepting any expected type.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * Note: This exists for symmetry with the value-level API.
 * At the type-level, you can omit `.of` for simpler syntax (e.g., `equiv<E, A>` instead of `equiv.of<E, A>`).
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.of<string, (arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.of<string, (arg: number) => any>
 * ```
 */
// oxfmt-ignore
type of_<$Expected, $Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never
const of_: typeof builder.parameter1.equiv.of = builder.parameter1.equiv.of

/**
 * Pre-curried matcher for string.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.string<(arg: string) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.string<(arg: number) => any>
 * ```
 */
// oxfmt-ignore
type string_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [string, __actual__]>
                                                                         : never
const string_: typeof builder.parameter1.equiv.string = builder.parameter1.equiv.string

/**
 * Pre-curried matcher for number.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.number<(arg: number) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.number<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type number_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [number, __actual__]>
                                                                         : never
const number_: typeof builder.parameter1.equiv.number = builder.parameter1.equiv.number

/**
 * Pre-curried matcher for bigint.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.bigint<(arg: bigint) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.bigint<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type bigint_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [bigint, __actual__]>
                                                                         : never
const bigint_: typeof builder.parameter1.equiv.bigint = builder.parameter1.equiv.bigint

/**
 * Pre-curried matcher for boolean.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.boolean<(arg: boolean) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.boolean<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type boolean_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [boolean, __actual__]>
                                                                         : never
const boolean_: typeof builder.parameter1.equiv.boolean = builder.parameter1.equiv.boolean

/**
 * Pre-curried matcher for true.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.true<(arg: true) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.true<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type true_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [true, __actual__]>
                                                                         : never
const true_: typeof builder.parameter1.equiv.true = builder.parameter1.equiv.true

/**
 * Pre-curried matcher for false.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.false<(arg: false) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.false<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type false_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [false, __actual__]>
                                                                         : never
const false_: typeof builder.parameter1.equiv.false = builder.parameter1.equiv.false

/**
 * Pre-curried matcher for undefined.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.undefined<(arg: undefined) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.undefined<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type undefined_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [undefined, __actual__]>
                                                                         : never
const undefined_: typeof builder.parameter1.equiv.undefined = builder.parameter1.equiv.undefined

/**
 * Pre-curried matcher for null.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.null<(arg: null) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.null<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type null_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [null, __actual__]>
                                                                         : never
const null_: typeof builder.parameter1.equiv.null = builder.parameter1.equiv.null

/**
 * Pre-curried matcher for symbol.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.symbol<(arg: symbol) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.symbol<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type symbol_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [symbol, __actual__]>
                                                                         : never
const symbol_: typeof builder.parameter1.equiv.symbol = builder.parameter1.equiv.symbol

/**
 * Pre-curried matcher for Date.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.Date<(arg: Date) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.Date<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Date_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Date, __actual__]>
                                                                         : never
const Date_: typeof builder.parameter1.equiv.Date = builder.parameter1.equiv.Date

/**
 * Pre-curried matcher for RegExp.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.RegExp<(arg: RegExp) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.RegExp<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type RegExp_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [RegExp, __actual__]>
                                                                         : never
const RegExp_: typeof builder.parameter1.equiv.RegExp = builder.parameter1.equiv.RegExp

/**
 * Pre-curried matcher for Error.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.Error<(arg: Error) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.Error<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type Error_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [Error, __actual__]>
                                                                         : never
const Error_: typeof builder.parameter1.equiv.Error = builder.parameter1.equiv.Error

/**
 * Pre-curried matcher for unknown.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.unknown<(arg: unknown) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.unknown<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type unknown_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [unknown, __actual__]>
                                                                         : never
const unknown_: typeof builder.parameter1.equiv.unknown = builder.parameter1.equiv.unknown

/**
 * Pre-curried matcher for any.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.any<(arg: any) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.any<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type any_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [any, __actual__]>
                                                                         : never
const any_: typeof builder.parameter1.equiv.any = builder.parameter1.equiv.any

/**
 * Pre-curried matcher for never.
 * Extraction chain: (p1: T, ...) => any → T
 *
 * @example
 * ```typescript
 * // ✓ Pass
 * type _ = Assert.parameter1.equiv.never<(arg: never) => any>
 *
 * // ✗ Fail
 * type _ = Assert.parameter1.equiv.never<(arg: string) => any>
 * ```
 */
// oxfmt-ignore
type never_<$Actual, __$ActualExtracted = Optic.Parameter1.Get<$Actual>> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [never, __actual__]>
                                                                         : never
const never_: typeof builder.parameter1.equiv.never = builder.parameter1.equiv.never

const ofAs_: typeof builder.parameter1.equiv.ofAs = builder.parameter1.equiv.ofAs
/**
 * No-excess variant of equiv relation.
 * Checks that actual has no excess properties beyond expected.
 */
// oxfmt-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter1.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivNoExcessKind, [$Expected, __actual__]>
                                                                         : never
const noExcess_: typeof builder.parameter1.equiv.noExcess = builder.parameter1.equiv.noExcess
const noExcessAs_: typeof builder.parameter1.equiv.noExcessAs = builder.parameter1.equiv.noExcessAs

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
