import type { SetKey } from './set.js'

/**
 * Create a new object with the same keys but with values transformed by a function.
 *
 * @category Transformation
 *
 * @param obj - The object to map values from
 * @param fn - Function to transform each value, receives the value and key
 * @returns A new object with transformed values
 *
 * @example
 * ```ts
 * const prices = { apple: 1.5, banana: 0.75, orange: 2 }
 * const doublePrices = mapValues(prices, (price) => price * 2)
 * // Result: { apple: 3, banana: 1.5, orange: 4 }
 * ```
 *
 * @example
 * ```ts
 * // Using the key parameter
 * const data = { a: 1, b: 2, c: 3 }
 * const withKeys = mapValues(data, (value, key) => `${key}: ${value}`)
 * // Result: { a: 'a: 1', b: 'b: 2', c: 'c: 3' }
 * ```
 */
export const mapValues = <rec extends Record<PropertyKey, any>, newValue>(
  obj: rec,
  fn: (value: rec[keyof rec], key: keyof rec) => newValue,
): Record<keyof rec, newValue> => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(v, k as keyof rec)]),
  ) as Record<keyof rec, newValue>
}

/**
 * Update an array-typed key by appending a single element.
 * Useful for builder patterns that accumulate values.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Pipeline = { steps: ['init'] }
 * type Updated = UpdateKeyWithAppendOne<Pipeline, 'steps', 'validate'>
 * // Result: { steps: ['init', 'validate'] }
 * ```
 */
// oxfmt-ignore
export type UpdateKeyWithAppendOne<
  $Obj extends object,
  $Prop extends keyof $Obj,
  $Type,
> =
  SetKey<
    $Obj,
    $Prop,
    // @ts-expect-error - We know $Obj[$Prop] is an array
    [...$Obj[$Prop], $Type]
  >

/**
 * Update an array-typed key by appending multiple elements.
 * Spreads all elements from the second array into the first.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Pipeline = { steps: ['init'] }
 * type Updated = UpdateKeyWithAppendMany<Pipeline, 'steps', ['validate', 'execute']>
 * // Result: { steps: ['init', 'validate', 'execute'] }
 * ```
 */
// oxfmt-ignore
export type UpdateKeyWithAppendMany<
  $Obj extends object,
  $Prop extends keyof $Obj,
  $Type extends readonly any[],
> =
  SetKey<
    $Obj,
    $Prop,
    // @ts-expect-error - We know $Obj[$Prop] is an array
    [...$Obj[$Prop], ...$Type]
  >

/**
 * Update a key by intersecting its type with a new type.
 * The resulting type has all properties from both types.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { profile: { name: string } }
 * type Updated = UpdateKeyWithIntersection<User, 'profile', { age: number }>
 * // Result: { profile: { name: string } & { age: number } }
 * ```
 */
export type UpdateKeyWithIntersection<
  $Obj extends object,
  $PropertyName extends keyof $Obj,
  $Type extends object,
> = $Obj & {
  [k in $PropertyName]: $Type
}
