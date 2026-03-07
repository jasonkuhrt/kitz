import type { Lang } from '#lang'
import { Obj } from '#obj'

/**
 * @category Types
 */
export type Any = AnyKeyTo<unknown>

/**
 * @category Types
 */
export type AnyReadonly = AnyReadonlyKeyTo<unknown>

/**
 * @category Types
 */
export type AnyKeyTo<$Value> = {
  [key: PropertyKey]: $Value
}

/**
 * @category Types
 */
export type AnyReadonlyKeyTo<$Value> = {
  readonly [key: PropertyKey]: $Value
}

/**
 * @category Types
 */
export type Value = {
  [key: PropertyKey]: Lang.Value
}

/**
 * Check if a value is a record (plain object only, not class instances or arrays).
 * This is a strict check that only accepts plain objects with Object.prototype.
 *
 * @param value - The value to check
 * @returns True if the value is a plain record object
 *
 * @example
 * ```ts
 * is({ a: 1, b: 2 }) // true
 * is({}) // true
 * is([1, 2, 3]) // false - arrays are not records
 * is(null) // false
 * is(new Date()) // false - class instances are not plain records
 * is(Object.create(null)) // false - not plain Object.prototype
 * ```
 *
 * @example
 * ```ts
 * // Type guard usage
 * function processData(data: unknown) {
 *   if (is(data)) {
 *     // data is typed as Rec.Any
 *     Object.keys(data).forEach(key => {
 *       console.log(data[key])
 *     })
 *   }
 * }
 * ```
 *
 * @category Type Guards
 */
export const is = (value: unknown): value is Any => {
  const proto = Obj.is(value) ? Object.getPrototypeOf(value) : undefined
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    // Allow plain objects (Object.prototype) and Object.create(null) objects, but reject class instances
    (proto === Object.prototype || proto === null)
  )
}

/**
 * Deep merge two records, with properties from the second record overwriting the first.
 * This is an alias for Obj.merge that works specifically with record types.
 *
 * @param rec1 - The base record to merge into
 * @param rec2 - The record to merge from
 * @returns A new record with properties from both records merged
 *
 * @example
 * ```ts
 * merge({ a: 1, b: 2 }, { b: 3, c: 4 })
 * // Returns: { a: 1, b: 3, c: 4 }
 * ```
 *
 * @example
 * ```ts
 * // Deep merging of nested records
 * merge(
 *   { user: { name: 'Alice', settings: { theme: 'dark' } } },
 *   { user: { settings: { fontSize: 16 } } }
 * )
 * // Returns: { user: { name: 'Alice', settings: { theme: 'dark', fontSize: 16 } } }
 * ```
 *
 * @example
 * ```ts
 * // Type-safe merging
 * type Config = { api: { url: string }; timeout?: number }
 * type Overrides = { api: { key: string }; timeout: number }
 *
 * const config: Config = { api: { url: 'https://api.com' } }
 * const overrides: Overrides = { api: { key: 'secret' }, timeout: 5000 }
 * const merged = merge(config, overrides)
 * // merged is typed as Config & Overrides
 * ```
 *
 * @category Operations
 */
export const merge = <rec1 extends Any, rec2 extends Any>(rec1: rec1, rec2: rec2): rec1 & rec2 => {
  return Obj.merge(rec1, rec2)
}

/**
 * @category Types
 */
export type Optional<$Key extends PropertyKey, $Value> = {
  [K in $Key]?: $Value
}

/**
 * Remove index signatures from an object type.
 * Useful for converting Record types to object types with only known keys.
 *
 * @example
 * ```ts
 * type WithIndex = { a: string; b: number; [key: string]: any }
 * type WithoutIndex = RemoveIndex<WithIndex>  // { a: string; b: number }
 * ```
 *
 * @category Types
 */
export type RemoveIndex<$T> = {
  [k in keyof $T as string extends k ? never : number extends k ? never : k]: $T[k]
}

/**
 * Check if a type has an index signature.
 *
 * @example
 * ```ts
 * type T1 = IsHasIndex<{ [key: string]: any }>  // true
 * type T2 = IsHasIndex<{ a: string }>  // false
 * type T3 = IsHasIndex<{ [key: number]: any }, number>  // true
 * ```
 *
 * @category Types
 */
export type IsHasIndex<$T, $Key extends PropertyKey = string> = $Key extends keyof $T ? true : false

/**
 * Create an empty record with a specific value type.
 * Useful for initializing typed record collections.
 *
 * @returns An empty record typed to hold values of the specified type
 *
 * @example
 * ```ts
 * const scores = create<number>()
 * scores['alice'] = 95
 * scores['bob'] = 87
 * // scores is typed as Record<PropertyKey, number>
 * ```
 *
 * @example
 * ```ts
 * // Creating typed lookups
 * interface User {
 *   id: string
 *   name: string
 * }
 *
 * const userLookup = create<User>()
 * userLookup['u123'] = { id: 'u123', name: 'Alice' }
 * ```
 *
 * @example
 * ```ts
 * // Useful as accumulator in reduce operations
 * const grouped = items.reduce(
 *   (acc, item) => {
 *     acc[item.category] = item
 *     return acc
 *   },
 *   create<Item>()
 * )
 * ```
 *
 * @category Factories
 */
export const create = <value>(): Record<PropertyKey, value> => {
  return {} as any
}
