/**
 * Union operations on objects.
 *
 * This module provides utilities for working with unions of object types,
 * solving common TypeScript limitations when dealing with union types:
 *
 * - `keyof (A | B)` returns only common keys (intersection), not all keys (union)
 * - `(A | B)['key']` returns `any` for keys not in all members
 * - No built-in way to merge union members while preserving value unions per key
 *
 * These utilities use distributive conditional types to properly handle each
 * union member separately, then combine the results.
 *
 * @see {@link Keys} - Get all keys from all union members
 * @see {@link ValueAt} - Get union of values for a specific key
 * @see {@link Merge} - Combine all members into single object with value unions
 */

/**
 * Merges a union of objects into a single object type where each key appears once
 * with a union of all possible values for that key across all union members.
 *
 * This is useful when you want to work with all possible properties from a union type
 * as a single object, rather than dealing with the union itself. Common use cases:
 * - Building type-safe configuration mergers
 * - Creating combined schemas from variant types
 * - Flattening discriminated unions for analysis
 *
 * Uses {@link Keys} to collect all property names and {@link ValueAt} to gather
 * the union of values for each key.
 *
 * @example
 * ```ts
 * // Basic merging
 * type A = { x: string, y: number }
 * type B = { x: boolean, z: string }
 *
 * type Result = Obj.Union.Merge<A | B>
 * // { x: string | boolean, y: number, z: string }
 * ```
 *
 * @example
 * ```ts
 * // Real-world: Discriminated union to merged config
 * type SuccessEvent = { status: 'success', data: string }
 * type ErrorEvent = { status: 'error', error: Error }
 * type Events = SuccessEvent | ErrorEvent
 *
 * type EventSchema = Obj.Union.Merge<Events>
 * // {
 * //   status: 'success' | 'error'
 * //   data: string
 * //   error: Error
 * // }
 * ```
 *
 * @example
 * ```ts
 * // Handles optional properties correctly
 * type Config1 = { host: string, port?: number }
 * type Config2 = { host: string, ssl?: boolean }
 *
 * type AllOptions = Obj.Union.Merge<Config1 | Config2>
 * // { host: string, port?: number, ssl?: boolean }
 * ```
 */
export type Merge<$Union extends object> = {
  [k in Keys<$Union>]: ValueAt<$Union, k>
}

/**
 * Collects all keys from all members of a union of objects into a single union of keys.
 *
 * **Problem:** TypeScript's built-in `keyof` operator on a union type returns only the
 * keys that are common to ALL union members (intersection behavior), not all possible
 * keys (union behavior). This is often counterintuitive when working with union types.
 *
 * **Solution:** This utility uses distributive conditional types to iterate over each
 * union member separately, extract its keys, then union all the results together.
 *
 * Common use cases:
 * - Type-safe property access across union members
 * - Building generic utilities that work with any key from union types
 * - Validating property names in discriminated unions
 *
 * @example
 * ```ts
 * // The problem with built-in keyof
 * type A = { x: string, y: number }
 * type B = { x: boolean, z: string }
 *
 * type Problem = keyof (A | B)  // 'x' (only keys in BOTH types)
 * type Solution = Obj.Union.Keys<A | B>  // 'x' | 'y' | 'z' (all keys)
 * ```
 *
 * @example
 * ```ts
 * // Real-world: Type-safe property picker for discriminated unions
 * type Circle = { kind: 'circle', radius: number }
 * type Square = { kind: 'square', size: number }
 * type Shape = Circle | Square
 *
 * type AllShapeKeys = Obj.Union.Keys<Shape>
 * // 'kind' | 'radius' | 'size'
 *
 * function getProperty<K extends AllShapeKeys>(
 *   shape: Shape,
 *   key: K
 * ): Obj.Union.ValueAt<Shape, K> {
 *   return (shape as any)[key]
 * }
 * ```
 *
 * @example
 * ```ts
 * // Works with optional properties
 * type Partial1 = { a?: string }
 * type Partial2 = { b?: number }
 *
 * type Keys = Obj.Union.Keys<Partial1 | Partial2>  // 'a' | 'b'
 * ```
 */
// oxfmt-ignore
export type Keys<
  $Union extends object,
> =
$Union extends __FORCE_DISTRIBUTION__ ?

  keyof $Union

: never

/**
 * Gets the union of all possible value types for a specific key across all members
 * of a union of objects.
 *
 * **Problem:** TypeScript's indexed access `(A | B)['key']` has problematic behavior:
 * - Returns `any` when the key doesn't exist in all union members
 * - Loses type information in complex union scenarios
 * - Doesn't handle optional properties correctly
 *
 * **Solution:** This utility uses distributive conditional types to:
 * 1. Check each union member separately for the key
 * 2. Collect the value type if present
 * 3. Return `never` for members without the key (which gets filtered from the union)
 * 4. Union all the collected value types together
 *
 * Common use cases:
 * - Type-safe property getters for union types
 * - Building mapped types over discriminated unions
 * - Creating type-safe validators for specific properties
 *
 * @example
 * ```ts
 * // The problem with built-in indexed access
 * type A = { x: string, y: number }
 * type B = { x: boolean, z: string }
 *
 * type Problem = (A | B)['y']  // any (unsafe - 'y' not in B!)
 * type Solution = Obj.Union.ValueAt<A | B, 'y'>  // number (correct!)
 * ```
 *
 * @example
 * ```ts
 * // Keys in all members produce value union
 * type A = { x: string, y: number }
 * type B = { x: boolean, z: string }
 *
 * type X = Obj.Union.ValueAt<A | B, 'x'>  // string | boolean
 * ```
 *
 * @example
 * ```ts
 * // Real-world: Type-safe discriminant extraction
 * type Success = { status: 'success', data: string }
 * type Error = { status: 'error', message: string }
 * type Result = Success | Error
 *
 * type Status = Obj.Union.ValueAt<Result, 'status'>
 * // 'success' | 'error'
 *
 * type Data = Obj.Union.ValueAt<Result, 'data'>
 * // string (only from Success, Error filtered as never)
 * ```
 *
 * @example
 * ```ts
 * // Keys not in any member return never
 * type A = { x: string }
 * type B = { y: number }
 *
 * type Missing = Obj.Union.ValueAt<A | B, 'z'>  // never
 * ```
 *
 * @example
 * ```ts
 * // Works with optional properties
 * type Config1 = { port?: number }
 * type Config2 = { port?: string }
 *
 * type Port = Obj.Union.ValueAt<Config1 | Config2, 'port'>
 * // number | string | undefined
 * ```
 */
// oxfmt-ignore
export type ValueAt<
  $Union extends object,
  $Key extends PropertyKey,
> =
$Union extends __FORCE_DISTRIBUTION__ ?

  $Key extends keyof $Union
    ? $Union[$Key]
    : never

: never

// Internal marker type to force distributive conditional type behavior
type __FORCE_DISTRIBUTION__ = any
