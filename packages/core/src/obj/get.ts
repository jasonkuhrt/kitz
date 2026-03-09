import { Arr } from '#arr'
import type { Ts } from '#ts'
import type { Undefined } from '#undefined'
import { type Any } from './type.js'

/**
 * Get an array of key-value pairs from an object.
 * Preserves exact types including optional properties and undefined values.
 *
 * @category Access
 *
 * @param obj - The object to extract entries from
 * @returns An array of tuples containing [key, value] pairs
 *
 * @example
 * ```ts
 * entries({ a: 1, b: 'hello', c: true })
 * // Returns: [['a', 1], ['b', 'hello'], ['c', true]]
 * ```
 *
 * @example
 * ```ts
 * // Handles optional properties and undefined values
 * entries({ a: 1, b?: 2, c: undefined })
 * // Returns proper types preserving optionality
 * ```
 */
export const entries = <obj extends Any>(obj: obj): Ts.Simplify.Top<entries<obj>> => {
  return Object.entries(obj) as any
}

// oxfmt-ignore
export type entries<obj extends Any> = {
  [K in keyof obj]-?: // Regarding "-?": we don't care about keys being undefined when we're trying to list out all the possible entries
    undefined extends obj[K]
      ? {} extends Pick<obj, K>
        ? [K, Undefined.Exclude<obj[K]>] // Optional key - remove only undefined, preserve null
        : [K, obj[K]] // Required key with undefined - preserve exact type including undefined
      : [K, obj[K]] // Required key without undefined - preserve exact type
}[keyof obj][]

/**
 * Get entries from an object with string keys only.
 *
 * @category Access
 *
 * @param obj - The object to extract entries from
 * @returns An array of [key, value] tuples where keys are strings
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 }
 * stringKeyEntries(obj)  // [['a', 1], ['b', 2]]
 * ```
 */
export const stringKeyEntries = <$T extends object>(
  obj: $T,
): [string & keyof $T, $T[keyof $T]][] => {
  return Object.entries(obj).map(([k, v]) => [k as string & keyof $T, v])
}

/**
 * Get entries from an object excluding undefined values.
 *
 * @category Access
 *
 * @param obj - The object to extract entries from
 * @returns An array of [key, value] tuples excluding undefined values
 * @example
 * ```ts
 * const obj = { a: 1, b: undefined, c: 2 }
 * entriesStrict(obj)  // [['a', 1], ['c', 2]]
 * ```
 */
export const entriesStrict = <$T extends object>(
  obj: $T,
): { [k in keyof $T]: [k, Exclude<$T[k], undefined>] }[keyof $T][] => {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k as keyof $T, v] as any)
}

/**
 * Get keys from an object with proper type inference.
 * Type-safe version of Object.keys.
 *
 * @category Access
 *
 * @param obj - The object to extract keys from
 * @returns An array of keys
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 }
 * keysStrict(obj)  // ['a', 'b'] with type ('a' | 'b')[]
 * ```
 */
export const keysStrict = <$T extends object>(obj: $T): (keyof $T)[] => {
  return Object.keys(obj) as (keyof $T)[]
}

/**
 * Get a random property value from an object
 *
 * @category Access
 *
 * @param obj - The object to get a random value from
 * @returns A random value from the object, or undefined for empty objects
 *
 * @example
 * ```ts
 * getRandomly({ a: 1, b: 2, c: 3 }) // Could return 1, 2, or 3
 * getRandomly({ a: 1, b: undefined }) // Could return 1 or undefined
 * getRandomly({}) // Returns undefined
 * ```
 */
export const getRandomly = <obj extends Any>(
  obj: obj,
): keyof obj extends never ? undefined : obj[keyof obj] => {
  const keys = toKeys(obj)

  if (Arr.isntEmpty(keys)) {
    const i = Arr.randomIndex(keys)
    const key = keys[i]!
    return obj[key] as any
  }

  return undefined as any
}

const toKeys = <obj extends object>(obj: obj): (keyof obj)[] => Object.keys(obj) as any

/**
 * Get a value at a path in an object.
 *
 * @category Access
 *
 * @param obj - The object to traverse
 * @param path - Array of property names representing the path
 * @returns The value at the path, or undefined if not found
 * @example
 * ```ts
 * const obj = { a: { b: { c: 42 } } }
 * getValueAtPath(obj, ['a', 'b', 'c'])  // 42
 * getValueAtPath(obj, ['a', 'x'])  // undefined
 * ```
 */
export const getValueAtPath = <$T, ___Path extends readonly string[]>(
  obj: $T,
  path: ___Path,
): any => {
  let current: any = obj

  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }

  return current
}

/**
 * Get an array of values from an object.
 * Type-safe version of Object.values.
 *
 * @category Access
 *
 * @param obj - The object to extract values from
 * @returns An array of values
 * @example
 * ```ts
 * const obj = { a: 1, b: 'hello', c: true }
 * values(obj)  // [1, 'hello', true] with type (string | number | boolean)[]
 * ```
 */
export const values = <$T extends object>(obj: $T): values<$T> => {
  return Object.values(obj) as $T[keyof $T][]
}

export type values<$Obj extends object> = $Obj[keyof $Obj][]

/**
 * Get the union of all value types from an object, or return empty object if no keys.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = ValuesOrEmptyObject<{ a: string; b: number }>  // string | number
 * type T2 = ValuesOrEmptyObject<{}>  // {}
 * type T3 = ValuesOrEmptyObject<Record<string, never>>  // {}
 * ```
 */
export type ValuesOrEmptyObject<$T> = keyof $T extends never ? {} : $T[keyof $T]

/**
 * Get value at key, or return fallback if key doesn't exist.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = GetKeyOr<{ a: string }, 'a', never>  // string
 * type T2 = GetKeyOr<{ a: string }, 'b', never>  // never
 * ```
 */
export type GetKeyOr<$T, $Key, $Or> = $Key extends keyof $T ? $T[$Key] : $Or

/**
 * Get value at key or return never.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = GetOrNever<{ a: string }, 'a'>  // string
 * type T2 = GetOrNever<{ a: string }, 'b'>  // never
 * ```
 */
export type GetOrNever<$O extends object, $P extends string> = $P extends keyof $O
  ? $O[$P]
  : $P extends `${infer __head__}.${infer __tail__}`
    ? __head__ extends keyof $O
      ? GetOrNever<$O[__head__] & object, __tail__>
      : never
    : never

/**
 * Get the union of all value types from an object, or return fallback if no keys.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = keyofOr<{ a: string; b: number }, never>  // string | number
 * type T2 = keyofOr<{}, 'fallback'>  // 'fallback'
 * ```
 */
export type keyofOr<$Obj extends object, $Or> = [keyof $Obj] extends [never]
  ? $Or
  : $Obj[keyof $Obj]

/**
 * Create an array type containing the keys of an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; email: string }
 * type UserKeys = KeysArray<User>
 * // Result: Array<'name' | 'age' | 'email'>
 * ```
 */
export type KeysArray<$Obj extends object> = Array<keyof $Obj>

/**
 * Create a readonly array type containing the keys of an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; email: string }
 * type UserKeys = KeysReadonlyArray<User>
 * // Result: ReadonlyArray<'name' | 'age' | 'email'>
 * ```
 */
export type KeysReadonlyArray<$Obj extends object> = ReadonlyArray<keyof $Obj>

/**
 * Extract only string keys from an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T = StringKeyof<{ a: 1; [x: number]: 2 }>  // 'a'
 * ```
 */
export type StringKeyof<$T> = keyof $T & string

/**
 * Extract keys from an object type that have primitive values.
 * Useful for serialization scenarios where only primitive values can be safely transferred.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = {
 *   id: number
 *   name: string
 *   createdAt: Date
 *   metadata: { tags: string[] }
 *   isActive: boolean
 * }
 * type SerializableKeys = PrimitiveFieldKeys<User>
 * // Result: 'id' | 'name' | 'createdAt' | 'isActive'
 * // Note: Date is considered primitive for serialization purposes
 * ```
 */
export type PrimitiveFieldKeys<$T> = {
  [K in keyof $T]: $T[K] extends string | number | boolean | bigint | null | undefined
    ? K
    : $T[K] extends Date
      ? K
      : never
}[keyof $T]

/**
 * Get a value at a path in an object type, returning undefined if the path doesn't exist.
 * Safely traverses nested objects without throwing type errors.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { profile: { name: string; age: number } }
 * type Name = GetAtPath<User, ['profile', 'name']>  // string
 * type Missing = GetAtPath<User, ['profile', 'email']>  // undefined
 * type Deep = GetAtPath<User, ['profile']>  // { name: string; age: number }
 * ```
 */
// oxfmt-ignore
export type GetAtPath<$Value, $Path extends readonly string[]> =
  $Value extends undefined                                              ? undefined :
  $Path extends [infer __p1__ extends string, ...infer __pn__ extends string[]] ? $Value extends object
                                                                          ? __p1__ extends keyof $Value
                                                                            ? GetAtPath<$Value[__p1__], __pn__>
                                                                            : undefined
                                                                          : undefined
                                                                        : $Value

/**
 * Get a value at a path in an object type, returning a default if the path doesn't exist.
 * Combines path traversal with default value fallback.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { profile?: { name: string } }
 * type Name = GetAtPathOrDefault<User, ['profile', 'name'], 'anonymous'>
 * // If profile.name exists: string
 * // If path doesn't exist: 'anonymous'
 * ```
 */
// oxfmt-ignore
export type GetAtPathOrDefault<$Obj, $Path extends readonly string[], $Default> =
  OrDefault<GetAtPath<$Obj, $Path>, $Default>

/**
 * Return the value if defined, otherwise return the default.
 * Handles both `undefined` values and `unknown` types (from optional properties).
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = OrDefault<string, 'fallback'>  // string
 * type T2 = OrDefault<undefined, 'fallback'>  // 'fallback'
 * type T3 = OrDefault<string | undefined, 'fallback'>  // 'fallback'
 * ```
 */
// oxfmt-ignore
export type OrDefault<$Value, $Default> =
  // When no value has been passed in because the property is optional,
  // then the inferred type is unknown.
  unknown extends $Value         ? $Default :
  undefined extends $Value       ? $Default :
                                   Exclude<$Value, undefined>
