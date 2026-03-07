import { Arr } from '#arr'
import { Lang } from '#lang'
import type { Ts } from '#ts'
import { is as isObj } from './is.js'
import { type Any } from './type.js'

interface MergeOptions {
  undefined?: boolean
  defaults?: boolean
  array?: (arr1: unknown[], arr2: unknown[]) => Lang.SideEffect
}

/**
 * Create a customized merge function with specific merge behavior options.
 * Allows control over how undefined values, defaults, and arrays are handled.
 *
 * @category Merging
 *
 * @param mergers - Options to customize merge behavior
 * @returns A merge function with the specified behavior
 *
 * @example
 * ```ts
 * // Create a merger that ignores undefined values
 * const mergeIgnoreUndefined = mergeWith({ undefined: false })
 * mergeIgnoreUndefined({ a: 1 }, { a: undefined, b: 2 })
 * // Returns: { a: 1, b: 2 }
 * ```
 *
 * @example
 * ```ts
 * // Create a merger that concatenates arrays
 * const mergeArrays = mergeWith({
 *   array: (a, b) => { a.push(...b) }
 * })
 * mergeArrays({ items: [1, 2] }, { items: [3, 4] })
 * // Returns: { items: [1, 2, 3, 4] }
 * ```
 */
// oxfmt-ignore
/*@__NO_SIDE_EFFECTS__*/
export const mergeWith =
	(mergers?: MergeOptions) =>
		<obj1 extends Any, obj2 extends Any>(obj1: obj1, obj2: obj2): obj1 & obj2 =>
			_mergeWith<obj1, obj2>(mergers ?? {}, obj1, obj2)

/**
 * Deep merge two objects, with properties from the second object overwriting the first.
 * Recursively merges nested objects, but arrays and other non-object values are replaced.
 *
 * @category Merging
 *
 * @param obj1 - The base object to merge into
 * @param obj2 - The object to merge from
 * @returns A new object with properties from both objects merged
 *
 * @example
 * ```ts
 * merge({ a: 1, b: 2 }, { b: 3, c: 4 })
 * // Returns: { a: 1, b: 3, c: 4 }
 * ```
 *
 * @example
 * ```ts
 * // Deep merging of nested objects
 * merge(
 *   { user: { name: 'Alice', age: 30 } },
 *   { user: { age: 31, city: 'NYC' } }
 * )
 * // Returns: { user: { name: 'Alice', age: 31, city: 'NYC' } }
 * ```
 *
 * @example
 * ```ts
 * // Arrays are replaced, not merged
 * merge({ tags: ['a', 'b'] }, { tags: ['c', 'd'] })
 * // Returns: { tags: ['c', 'd'] }
 * ```
 */
export const merge: <obj1 extends Any, obj2 extends Any>(obj1: obj1, obj2: obj2) => obj1 & obj2 =
  mergeWith() as any

/**
 * Deep merge two objects with special handling for arrays.
 * When both objects have an array at the same path, concatenates them instead of replacing.
 *
 * @category Merging
 *
 * @example
 * ```ts
 * mergeWithArrayPush(
 *   { tags: ['react', 'typescript'] },
 *   { tags: ['nodejs', 'express'] }
 * )
 * // Returns: { tags: ['react', 'typescript', 'nodejs', 'express'] }
 * ```
 *
 * @example
 * ```ts
 * // Works with nested arrays
 * mergeWithArrayPush(
 *   { user: { skills: ['js'] } },
 *   { user: { skills: ['ts'] } }
 * )
 * // Returns: { user: { skills: ['js', 'ts'] } }
 * ```
 */
export const mergeWithArrayPush = mergeWith({
  array: (a, b) => {
    a.push(...b)
  },
})

/**
 * Deep merge two objects with array concatenation and deduplication.
 * When both objects have an array at the same path, concatenates and removes duplicates.
 *
 * @category Merging
 *
 * @example
 * ```ts
 * mergeWithArrayPushDedupe(
 *   { tags: ['react', 'vue', 'react'] },
 *   { tags: ['react', 'angular'] }
 * )
 * // Returns: { tags: ['react', 'vue', 'angular'] }
 * ```
 *
 * @example
 * ```ts
 * // Preserves order with first occurrence kept
 * mergeWithArrayPushDedupe(
 *   { ids: [1, 2, 3] },
 *   { ids: [3, 4, 2, 5] }
 * )
 * // Returns: { ids: [1, 2, 3, 4, 5] }
 * ```
 */
export const mergeWithArrayPushDedupe = mergeWith({
  array: (a, b) => {
    a.push(...b)
    Arr.dedupe(a)
  },
})

/**
 * Merge default values into an object, only filling in missing properties.
 * Existing properties in the base object are preserved, even if undefined.
 *
 * @category Merging
 *
 * @param obj1 - The base object with potentially missing properties
 * @param obj1Defaults - The default values to fill in
 * @returns The object with defaults applied
 *
 * @example
 * ```ts
 * mergeDefaults(
 *   { name: 'Alice', age: undefined },
 *   { name: 'Unknown', age: 0, city: 'NYC' }
 * )
 * // Returns: { name: 'Alice', age: undefined, city: 'NYC' }
 * // Note: existing properties (even undefined) are not overwritten
 * ```
 *
 * @example
 * ```ts
 * // Useful for configuration objects
 * const config = { port: 3000 }
 * const defaults = { port: 8080, host: 'localhost', debug: false }
 * mergeDefaults(config, defaults)
 * // Returns: { port: 3000, host: 'localhost', debug: false }
 * ```
 */
export const mergeDefaults: <obj1 extends Any, obj1Defaults extends Partial<obj1>>(
  obj1: obj1,
  obj1Defaults: obj1Defaults,
) => Ts.Simplify.Top<obj1 & obj1Defaults> = mergeWith({ defaults: true }) as any

/**
 * Shallow merge two objects with later values overriding earlier ones.
 * Useful for providing defaults that can be overridden.
 *
 * @category Merging
 *
 * @param defaults - The default values
 * @param input - The input values that override defaults
 * @returns Merged object
 * @example
 * ```ts
 * const defaults = { a: 1, b: 2, c: 3 }
 * const input = { b: 20 }
 * shallowMergeDefaults(defaults, input)  // { a: 1, b: 20, c: 3 }
 * ```
 */
export const shallowMergeDefaults = <$Defaults extends object, $Input extends object>(
  defaults: $Defaults,
  input: $Input,
): $Defaults & $Input => {
  return { ...defaults, ...input }
}

/**
 * Shallow merge objects while omitting undefined values.
 * Simplifies the common pattern of conditionally spreading objects
 * to avoid including undefined values that would override existing values.
 *
 * @category Merging
 *
 * @param objects - Objects to merge (later objects override earlier ones). Undefined objects are ignored.
 * @returns Merged object with undefined values omitted
 *
 * @example
 * ```ts
 * // Instead of:
 * const config = {
 *   ...defaultConfig,
 *   ...(userConfig ? userConfig : {}),
 *   ...(debug ? { debug: true } : {}),
 * }
 *
 * // Use:
 * const config = spreadShallow(
 *   defaultConfig,
 *   userConfig,
 *   { debug: debug ? true : undefined }
 * )
 * // undefined values won't override earlier values
 * ```
 */
export const spreadShallow = <$Objects extends readonly (object | undefined)[]>(
  ...objects: $Objects
): MergeAllShallow<Exclude<$Objects[number], undefined>[]> => {
  const result = {} as any

  for (const obj of objects) {
    if (obj === undefined) continue

    for (const key in obj) {
      // Protect against prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }

      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key as keyof typeof obj]
        if (value !== undefined) {
          result[key] = value
        }
      }
    }
  }

  return result
}

// oxfmt-ignore
export type MergeShallow<
  $Object1 extends Any,
  $Object2 extends Any,
  __ =
    {} extends $Object1
      ? $Object2
      : & $Object2
        // Keys from $Object1 that are NOT in $Object2
        & {
            [__k__ in keyof $Object1 as __k__ extends keyof $Object2 ? never : __k__]: $Object1[__k__]
          }
> = __

/**
 * Recursively merge an array of objects using shallow merge semantics.
 * Each object in the array overrides properties from previous objects.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = MergeAllShallow<[{ a: string }, { b: number }, { c: boolean }]>
 * // Result: { a: string; b: number; c: boolean }
 * ```
 */
// oxfmt-ignore
export type MergeAllShallow<$Objects extends readonly object[]> =
  $Objects extends readonly [infer $First extends object, ...infer $Rest extends object[]]
    ? $Rest extends readonly []
      ? $First
      : MergeShallow<$First, MergeAllShallow<$Rest>>
    : {}

/**
 * Merge an array of object types into a single type using deep merge semantics.
 * Uses TypeScript's intersection type (`&`) for merging.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = MergeAll<[{ a: string }, { b: number }]>
 * // Result: { a: string; b: number }
 * ```
 */
export type MergeAll<$Objects extends object[]> = $Objects extends [
  infer __first__ extends object,
  ...infer __rest__ extends object[],
]
  ? __first__ & MergeAll<__rest__>
  : {}

/**
 * Replace the type of a specific property in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string; age: number }
 * type UpdatedUser = ReplaceProperty<User, 'id', string>
 * // Result: { id: string; name: string; age: number }
 * ```
 */
export type ReplaceProperty<$Obj extends object, $Key extends keyof $Obj, $NewType> = Omit<
  $Obj,
  $Key
> & {
  [_ in $Key]: $NewType
}

/**
 * Replace properties in an object type with new types.
 * Useful for overriding specific property types.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string; createdAt: Date }
 * type SerializedUser = Replace<User, { createdAt: string }>
 * // Result: { id: number; name: string; createdAt: string }
 * ```
 */
export type Replace<$Object1, $Object2> = Omit<$Object1, keyof $Object2> & $Object2

// ---- INTERNALS ----

const _mergeWith = <obj1 extends Any, obj2 extends Any>(
  options: MergeOptions,
  obj1: obj1,
  obj2: obj2,
): obj1 & obj2 => {
  const obj1_AS = obj1 as Record<PropertyKey, unknown>
  const obj2_AS = obj2 as Record<PropertyKey, unknown>

  for (const k2 in obj2_AS) {
    const obj1Value = obj1_AS[k2]
    const obj2Value = obj2_AS[k2]

    if (isObj(obj2Value) && isObj(obj1Value)) {
      obj1_AS[k2] = _mergeWith(options, obj1Value, obj2Value)
      continue
    }

    if (Arr.is(obj2Value) && Arr.is(obj1Value) && options.array) {
      options.array(obj1Value, obj2Value)
      obj1_AS[k2] = obj1Value
      continue
    }

    if (obj2Value === undefined && options.undefined !== true) {
      continue
    }

    if (obj1Value !== undefined && options.defaults === true) {
      continue
    }

    obj1_AS[k2] = obj2Value
  }

  return obj1 as any
}
