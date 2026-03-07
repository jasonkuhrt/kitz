import { is } from './fn.js'

/**
 * A lazy value that is computed when called.
 * @template $Value - The type of value that will be returned when the lazy function is invoked
 *
 * @category Lazy Values
 */
export type Lazy<$Value> = () => $Value

/**
 * Creates a lazy value that returns the given value when invoked.
 * @template value - The type of the value to be lazily returned
 * @param value - The value to wrap in a lazy computation
 * @returns A function that returns the wrapped value when called
 *
 * @category Lazy Values
 */
export const lazy =
  <const value>(value: value): Lazy<typeof value> =>
  () =>
    value

/**
 * A value that may be either immediate or lazy.
 * @template $Value - The type of the value, whether immediate or lazy
 *
 * @category Lazy Values
 */
export type LazyMaybe<$Value = unknown> = $Value | Lazy<$Value>

/**
 * Type-level resolution of a LazyMaybe value.
 * Extracts the underlying value type whether it's lazy or immediate.
 * @template $LazyMaybeValue - A value that may be lazy or immediate
 *
 * @category Lazy Values
 */
// oxfmt-ignore
export type resolveLazy<$LazyMaybeValue extends LazyMaybe<any>> =
  $LazyMaybeValue extends Lazy<infer __value__> ? __value__ : $LazyMaybeValue

/**
 * Resolves a value that may be lazy or immediate.
 * If the value is a function (lazy), it calls it to get the result.
 * If the value is immediate, it returns it as-is.
 *
 * @category Lazy Values
 */
export const resolveLazy = <lazyMaybeValue extends LazyMaybe>(
  lazyMaybeValue: lazyMaybeValue,
): resolveLazy<lazyMaybeValue> => {
  if (is(lazyMaybeValue)) return lazyMaybeValue()
  return lazyMaybeValue as any
}
