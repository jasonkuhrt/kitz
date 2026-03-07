import { CoreLang as Lang } from '#lang/core'
import type { Obj } from '#obj'
import type { Prom } from '#prom'

/**
 * @category Type Utilities
 */
export type AnyAny = (...args: any[]) => any

/**
 * @category Type Utilities
 */
export type AnyAnyParameters2 = (arg1: any, arg2: any) => any

/**
 * @category Type Utilities
 */
export type AnyAnyParametersMin1 = (...args: [any, ...any[]]) => any

/**
 * @category Type Utilities
 */
export type AnyAnyParametersMin2 = (...args: [any, any, ...any[]]) => any

/**
 * @category Type Utilities
 */
export type AnyAnyParametersMin3 = (...args: [any, any, any, ...any[]]) => any

/**
 * @category Type Guards
 */
export const is = Lang.typeGuard<AnyAny>((value) => typeof value === Lang.TypeofTypesEnum.function)

/**
 * @category Type Utilities
 */
export type AnyAnyAsync = (...args: any[]) => Prom.AnyAny

/**
 * Extract the guarded type from a type guard function.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * const isString = (x: any): x is string => typeof x === 'string'
 * type T = GuardedType<typeof isString>  // string
 * ```
 */
export type GuardedType<$T> = $T extends ((x: any) => x is infer __u__) ? __u__ : never

/**
 * Modify function such that it only returns the given type.
 *
 * Automatically handles async functions by unwrapping the Promise, extracting the type,
 * and rewrapping in a Promise. For sync functions, the type is extracted directly.
 *
 * Assumes that the given type is among the possible return types of the function.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * // Sync function
 * type Fn1 = (x: number) => string | number
 * type Result1 = ReturnExtract<string, Fn1>  // (x: number) => string
 *
 * // Async function - automatically unwraps and rewraps Promise
 * type Fn2 = (x: number) => Promise<string | number>
 * type Result2 = ReturnExtract<string, Fn2>  // (x: number) => Promise<string>
 * ```
 */
// oxfmt-ignore
export type ReturnExtract<$Type, $Fn extends AnyAny> =
	$Fn extends (...args: infer __args__) => infer __return__
			? (...args: __args__) =>
        __return__ extends Prom.AnyAny
          ? Promise<Extract<Awaited<__return__>, $Type>>
          : Extract<__return__, $Type>
			: never

/**
 * @category Type Utilities
 */
// oxfmt-ignore
export type ReturnReplace<$Fn extends AnyAny, $Type> =
  $Fn extends (...args: infer __args__) => infer __return__
    ? (...args: __args__) => $Type
    : never

/**
 * Modify function such that it does not return the given type.
 *
 * Automatically handles async functions by unwrapping the Promise, excluding the type,
 * and rewrapping in a Promise. For sync functions, the type is excluded directly.
 *
 * If function does not return the given the type, then this is effectively an identity function.
 *
 * @category Type Utilities
 * @example
 * ```ts
 * // Sync function
 * type Fn1 = (x: number) => string | null
 * type Result1 = ReturnExclude<null, Fn1>  // (x: number) => string
 *
 * // Async function - automatically unwraps and rewraps Promise
 * type Fn2 = (x: number) => Promise<string | null>
 * type Result2 = ReturnExclude<null, Fn2>  // (x: number) => Promise<string>
 * ```
 */
// oxfmt-ignore
export type ReturnExclude<$Type, $Fn extends AnyAny> =
  $Fn extends (...args: infer __args__) => infer __return__
    ? (...args: __args__) => (
        __return__ extends Prom.AnyAny
          ? Promise<Exclude<Awaited<__return__>, $Type>>
          : Exclude<__return__, $Type>
    )
    : never

/**
 * @category Type Utilities
 */
export type ReturnExcludeNull<$Fn extends AnyAny> = ReturnExclude<null, $Fn>

/**
 * Modify function such that it can return an additional type along with its original return types.
 *
 * Automatically handles async functions by unwrapping the Promise, adding the type to the union,
 * and rewrapping in a Promise. For sync functions, the type is added directly to the return type union.
 *
 * This is useful for functions that may return early with a specific type (like void).
 *
 * @category Type Utilities
 * @example
 * ```ts
 * // Sync function
 * type Fn1 = (x: number) => string
 * type Result1 = ReturnInclude<null, Fn1>  // (x: number) => string | null
 *
 * // Async function - automatically unwraps and rewraps Promise
 * type Fn2 = (x: number) => Promise<string>
 * type Result2 = ReturnInclude<null, Fn2>  // (x: number) => Promise<string | null>
 * ```
 */
// oxfmt-ignore
export type ReturnInclude<$Type, $Fn extends AnyAny> =
  $Fn extends (...args: infer __args__) => infer __return__
    ? (...args: __args__) => (
        __return__ extends Prom.AnyAny
          ? Promise<$Type | Awaited<__return__>>
          : $Type | __return__
    )
    : never

// Binding

/**
 * @category Currying & Binding
 */
export const bind = <fn extends AnyAny>(
  fn: AnyAnyParametersMin1 extends fn
    ? fn
    : {
        Error: 'Given function must have at least one parameter'
      },
  arg: Parameters<fn>[0],
): bind<fn> => {
  const fn_ = fn as AnyAny
  return fn_.bind(null, arg) as any
}

/**
 * @category Currying & Binding
 */
// oxfmt-ignore
export type bind<$Fn extends AnyAnyParametersMin1> =
  $Fn extends (...args: [any, ...infer __args_tail__]) => infer __return__
    ? (...args: __args_tail__) => __return__
    : never

/**
 * @category Basic Functions
 */
export const noop = () => {}

/**
 * @category Basic Functions
 */
export const $identityPartial = <value>(value: Obj.PartialDeep<value>): value => value as any

// Curried function utilities

/**
 * Apply the second parameter of a curried function.
 * For a function (a) => (b) => c and a value b, returns (a) => c
 * Useful for creating service interfaces from curried operations.
 *
 * @category Currying & Binding
 */
export const applySecond = <fn extends (...args: any[]) => (arg: any) => any, arg>(
  fn: fn,
  arg: arg,
): applySecond<fn, arg> => {
  return ((...args: any[]) => fn(...args)(arg)) as any
}

/**
 * Apply the second parameter of a curried function.
 * For a function (a) => (b) => c, returns (a) => c
 * Useful for creating service interfaces from curried operations.
 *
 * @category Currying & Binding
 */
// oxfmt-ignore
export type applySecond<$Fn, $Arg> =
  $Fn extends (...args: infer __args__) => (arg: $Arg) => infer __return__
    ? (...args: __args__) => __return__
    : never
