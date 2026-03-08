import { Ts } from '#ts'
import { Undefined } from '#undefined'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Functions
//
//
//
//

/**
 * Create a new object with only the specified properties.
 *
 * @category Filtering
 *
 * @param obj - The object to pick properties from
 * @param keysOrPredicateOrFilter - Array of property keys to include, a predicate function `(key) => boolean`, or a filter function `(key, value, obj) => boolean`
 * @returns A new object containing only the specified properties
 *
 * @example
 * ```ts
 * // Using array of keys
 * const user = { name: 'Alice', age: 30, email: 'alice@example.com' }
 * const publicInfo = pick(user, ['name', 'email'])
 * // Result: { name: 'Alice', email: 'alice@example.com' }
 * ```
 *
 * @example
 * ```ts
 * // Type-safe property selection
 * interface User {
 *   id: number
 *   name: string
 *   password: string
 *   email: string
 * }
 *
 * function getPublicUser(user: User) {
 *   return pick(user, ['id', 'name', 'email'])
 *   // Type: Pick<User, 'id' | 'name' | 'email'>
 * }
 * ```
 *
 * @example
 * ```ts
 * // Using a predicate function (key only)
 * const obj = { a: 1, b: 2, c: 3 }
 * pick(obj, k => k !== 'b') // { a: 1, c: 3 }
 * ```
 *
 * @example
 * ```ts
 * // Using a filter function (key, value, obj)
 * const obj = { a: 1, b: 2, c: 3 }
 * pick(obj, (k, v) => v > 1) // { b: 2, c: 3 }
 * pick(obj, (k, v, o) => v > average(o)) // picks above-average values
 * ```
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>
export function pick<$Object extends object>(
  obj: $Object,
  predicate: (key: keyof $Object, value?: never, obj?: never) => boolean,
): Partial<$Object>
export function pick<$Object extends object>(
  obj: $Object,
  predicate: (key: keyof $Object, value: $Object[keyof $Object], obj?: $Object) => boolean,
): Partial<$Object>
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keysOrPredicate: readonly K[] | ((key: keyof T, value?: any, obj?: any) => boolean),
): Pick<T, K> | Partial<T> {
  if (typeof keysOrPredicate === 'function') {
    return filter(obj, keysOrPredicate as any)
  }
  return policyFilter('allow', obj, keysOrPredicate) as any
}

/**
 * Curried version of pick - takes keys/predicate first, then object.
 *
 * @category Filtering
 */
export const pickWith =
  <K extends PropertyKey>(
    keysOrPredicate: readonly K[] | ((key: PropertyKey, value?: any, obj?: any) => boolean),
  ) =>
  <T extends object>(obj: T): any => {
    return pick(obj, keysOrPredicate as any)
  }

/**
 * Curried version of pick - takes object first, then keys/predicate.
 *
 * @category Filtering
 */
export const pickOn =
  <T extends object>(obj: T) =>
  <K extends keyof T>(
    keysOrPredicate: readonly K[] | ((key: keyof T, value?: any, obj?: any) => boolean),
  ): any => {
    return pick(obj, keysOrPredicate as any)
  }

/**
 * Create a new object with the specified properties removed.
 *
 * @category Filtering
 *
 * @param obj - The object to omit properties from
 * @param keysOrPredicateOrFilter - Array of property keys to exclude, a predicate function `(key) => boolean` (keys matching are excluded), or a filter function `(key, value, obj) => boolean` (keys matching are excluded)
 * @returns A new object without the specified properties
 *
 * @example
 * ```ts
 * // Using array of keys
 * const user = { name: 'Alice', age: 30, password: 'secret' }
 * const safeUser = omit(user, ['password'])
 * // Result: { name: 'Alice', age: 30 }
 * ```
 *
 * @example
 * ```ts
 * // Remove sensitive fields
 * interface User {
 *   id: number
 *   name: string
 *   password: string
 *   apiKey: string
 * }
 *
 * function sanitizeUser(user: User) {
 *   return omit(user, ['password', 'apiKey'])
 *   // Type: Omit<User, 'password' | 'apiKey'>
 * }
 * ```
 *
 * @example
 * ```ts
 * // Using a predicate function (key only)
 * const obj = { a: 1, b: 2, c: 3 }
 * omit(obj, k => k === 'b') // { a: 1, c: 3 } (excludes b)
 * ```
 *
 * @example
 * ```ts
 * // Using a filter function (key, value, obj)
 * const obj = { a: 1, b: 2, c: 3 }
 * omit(obj, (k, v) => v > 1) // { a: 1 } (excludes b and c where value > 1)
 * omit(obj, (k, v, o) => v > average(o)) // excludes above-average values
 * ```
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K>
export function omit<$Object extends object>(
  obj: $Object,
  predicate: (key: keyof $Object, value?: never, obj?: never) => boolean,
): Partial<$Object>
export function omit<$Object extends object>(
  obj: $Object,
  predicate: (key: keyof $Object, value: $Object[keyof $Object], obj?: $Object) => boolean,
): Partial<$Object>
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keysOrPredicate: readonly K[] | ((key: keyof T, value?: any, obj?: any) => boolean),
): Omit<T, K> | Partial<T> {
  if (typeof keysOrPredicate === 'function') {
    // Invert the predicate - omit removes keys where predicate is true
    return filter(obj, (k, v, o) => !(keysOrPredicate as any)(k, v, o))
  }
  return policyFilter('deny', obj, keysOrPredicate) as any
}

/**
 * Curried version of omit - takes keys/predicate first, then object.
 *
 * @category Filtering
 */
export const omitWith =
  <K extends PropertyKey>(
    keysOrPredicate: readonly K[] | ((key: PropertyKey, value?: any, obj?: any) => boolean),
  ) =>
  <T extends object>(obj: T): any => {
    return omit(obj, keysOrPredicate as any)
  }

/**
 * Curried version of omit - takes object first, then keys/predicate.
 *
 * @category Filtering
 */
export const omitOn =
  <T extends object>(obj: T) =>
  <K extends keyof T>(
    keysOrPredicate: readonly K[] | ((key: keyof T, value?: any, obj?: any) => boolean),
  ): any => {
    return omit(obj, keysOrPredicate as any)
  }

/**
 * Filter object properties based on a policy mode and set of keys.
 *
 * @category Filtering
 *
 * @param mode - 'allow' to keep only specified keys, 'deny' to remove specified keys
 * @param obj - The object to filter
 * @param keys - The keys to process
 * @returns A filtered object with proper type inference
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2, c: 3 }
 *
 * // Allow mode: keep only 'a' and 'c'
 * policyFilter('allow', obj, ['a', 'c']) // { a: 1, c: 3 }
 *
 * // Deny mode: remove 'a' and 'c'
 * policyFilter('deny', obj, ['a', 'c']) // { b: 2 }
 * ```
 */
export const policyFilter = <
  $Object extends object,
  $Key extends Keyof<$Object>,
  $Mode extends 'allow' | 'deny',
>(
  mode: $Mode,
  obj: $Object,
  keys: readonly $Key[],
): PolicyFilter<$Object, $Key, $Mode> => {
  const result: any = mode === 'deny' ? { ...obj } : {}

  if (mode === 'allow') {
    // For allow mode, only add specified keys
    for (const key of keys) {
      if (key in obj) {
        // @ts-expect-error - Type '$Key' cannot be used to index type '$Object'
        result[key] = obj[key]
      }
    }
  } else {
    // For deny mode, remove specified keys
    for (const key of keys) {
      delete result[key]
    }
  }

  return result
}

/**
 * Remove all properties with `undefined` values from an object.
 *
 * @category Filtering
 *
 * @param obj - The object to filter
 * @returns A new object without properties that had `undefined` values
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: undefined, c: 'hello', d: undefined }
 * omitUndefined(obj) // { a: 1, c: 'hello' }
 * ```
 *
 * @example
 * ```ts
 * // Useful for cleaning up optional parameters
 * const config = {
 *   host: 'localhost',
 *   port: options.port,      // might be undefined
 *   timeout: options.timeout  // might be undefined
 * }
 * const cleanConfig = omitUndefined(config)
 * // Only includes properties that have actual values
 * ```
 */
export const omitUndefined = omitWith(Undefined.isnt)

export interface partition extends Ts.SimpleSignature.SimpleSignature<
  [(obj: object, pickedKeys: readonly string[]) => { picked: object; omitted: object }]
> {
  <$Object extends object, $Key extends keyof $Object>(
    obj: $Object,
    pickedKeys: readonly $Key[],
  ): { omitted: Omit<$Object, $Key>; picked: Pick<$Object, $Key> }
}

/**
 * Partition an object into picked and omitted parts.
 *
 * @category Filtering
 *
 * @param obj - The object to partition
 * @param pickedKeys - The keys to pick
 * @returns An object with picked and omitted properties
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2, c: 3 }
 * const { picked, omitted } = partition(obj, ['a', 'c'])
 * // picked: { a: 1, c: 3 }
 * // omitted: { b: 2 }
 * ```
 */
export const partition = Ts.SimpleSignature.implement<partition>((obj, pickedKeys) => {
  // oxfmt-ignore
  return pickedKeys.reduce((acc, key) => {
    if (key in acc.omitted) {
      delete acc.omitted[key]
      ;(acc.picked)[key] = (obj as any)[key]
    }
    return acc
  }, {
    omitted: { ...obj },
    picked: {},
  } as any)
})

/**
 * Filter object properties by key pattern matching.
 * Useful for extracting properties that match a pattern like data attributes.
 *
 * @category Filtering
 *
 * @param obj - The object to filter
 * @param predicate - Function that returns true to keep a key
 * @returns A new object with only the key/value pairs where key predicate returned true
 *
 * @example
 * ```ts
 * const props = {
 *   'data-type': 'button',
 *   'data-current': true,
 *   onClick: fn,
 *   className: 'btn'
 * }
 * const dataAttrs = pickMatching(props, key => key.startsWith('data-'))
 * // Result: { 'data-type': 'button', 'data-current': true }
 * ```
 */
export const pickMatching = <T extends object>(
  obj: T,
  predicate: (key: string) => boolean,
): Partial<T> => {
  return pick(obj, (key) => predicate(key as string))
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type Utilities
//
//
//
//

/**
 * Like keyof but returns PropertyKey for object type.
 * Helper type for generic object key operations.
 *
 * @category Type Utilities
 */
export type Keyof<$Object extends object> = object extends $Object ? PropertyKey : keyof $Object

/**
 * Filter object properties based on a policy mode and set of keys.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string; email: string; password: string }
 * // Allow mode: keep only specified keys
 * type PublicUser = PolicyFilter<User, 'id' | 'name', 'allow'>
 * // Result: { id: number; name: string }
 *
 * // Deny mode: remove specified keys
 * type SafeUser = PolicyFilter<User, 'password', 'deny'>
 * // Result: { id: number; name: string; email: string }
 * ```
 */
// oxfmt-ignore
export type PolicyFilter<
  $Object extends object,
  $Key extends Keyof<$Object>,
  $Mode extends 'allow' | 'deny',
> = $Mode extends 'allow'
      ? Pick<$Object, Extract<$Key, keyof $Object>>
      : Omit<$Object, Extract<$Key, keyof $Object>>

/**
 * Pick properties from an object where the values extend a given constraint.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; isActive: boolean; flag: boolean }
 * type BooleanProps = PickWhereValueExtends<User, boolean>
 * // Result: { isActive: boolean; flag: boolean }
 * ```
 */
export type PickWhereValueExtends<$Obj extends object, $Constraint> = {
  [k in keyof $Obj as $Obj[k] extends $Constraint ? k : never]: $Obj[k]
}

/**
 * Add a suffix to all property names in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = SuffixKeyNames<'_old', { a: string; b: number }>
 * // { a_old: string; b_old: number }
 * ```
 */
export type SuffixKeyNames<$Suffix extends string, $Object extends object> = {
  [k in keyof $Object as k extends string ? `${k}${$Suffix}` : k]: $Object[k]
}

/**
 * Omit all keys that start with a specific prefix.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = OmitKeysWithPrefix<{ _a: string; _b: number; c: boolean }, '_'>
 * // { c: boolean }
 * ```
 */
export type OmitKeysWithPrefix<$Object extends object, $Prefix extends string> = {
  [k in keyof $Object as k extends `${$Prefix}${string}` ? never : k]: $Object[k]
}

/**
 * Pick only the required (non-optional) properties from an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = PickRequiredProperties<{ a: string; b?: number }>  // { a: string }
 * ```
 */
export type PickRequiredProperties<$T extends object> = {
  [k in keyof $T as {} extends Pick<$T, k> ? never : k]: $T[k]
}

/**
 * Make specific properties required in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = RequireProperties<{ a?: string; b?: number }, 'a'>
 * // { a: string; b?: number }
 * ```
 */
export type RequireProperties<$O extends object, $K extends keyof $O> = Ts.Simplify.Top<
  $O & { [k in $K]-?: $O[k] }
>

/**
 * Make all properties optional and allow undefined values.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = PartialOrUndefined<{ a: string; b: number }>
 * // { a?: string | undefined; b?: number | undefined }
 * ```
 */
export type PartialOrUndefined<$T> = {
  [k in keyof $T]?: $T[k] | undefined
}

/**
 * Pick an optional property or use fallback if required.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = PickOptionalPropertyOrFallback<{ a?: string }, 'a', never>  // string
 * type T2 = PickOptionalPropertyOrFallback<{ a: string }, 'a', never>  // never
 * ```
 */
export type PickOptionalPropertyOrFallback<
  $Object extends object,
  $Property extends keyof $Object,
  $Fallback,
> = {} extends Pick<$Object, $Property> ? $Object[$Property] : $Fallback

/**
 * Pick only the properties from an object that exist in a provided array of keys.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string; age: number; email: string }
 * type PublicUser = OnlyKeysInArray<User, ['name', 'email']>
 * // Result: { name: string; email: string }
 * ```
 */
export type OnlyKeysInArray<$Obj extends object, $KeysArray extends readonly string[]> = {
  [k in keyof $Obj as k extends $KeysArray[number] ? k : never]: $Obj[k]
}

/**
 * Filter an object using a predicate function.
 * Internal helper used by `pick` and `omit`.
 *
 * @internal
 */
const filter = <$Object extends object>(
  obj: $Object,
  predicate: (key: keyof $Object, value: $Object[keyof $Object], obj: $Object) => boolean,
): Partial<$Object> => {
  const result = {} as Partial<$Object>
  for (const key in obj) {
    if (predicate(key, obj[key], obj)) {
      result[key] = obj[key]
    }
  }
  return result
}
