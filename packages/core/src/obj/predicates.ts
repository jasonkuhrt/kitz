import type { Undefined } from '#undefined'

/**
 * Check if an interface has any optional properties.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = HasOptionalKeys<{ a?: string }>  // true
 * type T2 = HasOptionalKeys<{ a: string }>  // false
 * ```
 */
export type HasOptionalKeys<$Obj extends object> = OptionalKeys<$Obj> extends never ? false : true

/**
 * Extract keys that are optional in the interface.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Obj = { a: string; b?: number; c?: boolean }
 * type Optional = OptionalKeys<Obj>  // 'b' | 'c'
 * ```
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * Extract keys that are required in the interface.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Obj = { a: string; b?: number; c?: boolean }
 * type Required = RequiredKeys<Obj>  // 'a'
 * ```
 */
export type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>

/**
 * Check if an interface has any required properties.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = HasRequiredKeys<{ a: string }>  // true
 * type T2 = HasRequiredKeys<{ a?: string }>  // false
 * type T3 = HasRequiredKeys<{ a: string; b?: number }>  // true
 * ```
 */
export type HasRequiredKeys<$Obj extends object> = RequiredKeys<$Obj> extends never ? false : true

/**
 * Check if a key is optional in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = HasOptionalKey<{ a?: string }, 'a'>  // true
 * type T2 = HasOptionalKey<{ a: string }, 'a'>  // false
 * ```
 */
export type HasOptionalKey<
  $Object extends object,
  $Key extends keyof $Object,
> = undefined extends $Object[$Key] ? true : false

/**
 * Check if a key is optional in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = IsKeyOptional<{ a?: string }, 'a'>  // true
 * type T2 = IsKeyOptional<{ a: string }, 'a'>  // false
 * type T3 = IsKeyOptional<{ a: string }, 'b'>  // false
 * ```
 */
export type IsKeyOptional<
  $T extends Undefined.Maybe<object>,
  $K extends string,
> = $K extends keyof $T ? ({} extends Pick<$T, $K> ? true : false) : false

/**
 * Check if a key exists in an object.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = HasKey<{ a: string }, 'a'>  // true
 * type T2 = HasKey<{ a: string }, 'b'>  // false
 * ```
 */
export type HasKey<$T extends object, $K extends string> = $K extends keyof $T ? true : false

/**
 * Check if an object has any keys.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = HasKeys<{ a: string }>  // true
 * type T2 = HasKeys<{}>  // false
 * type T3 = HasKeys<Record<string, never>>  // false
 * ```
 */
export type HasKeys<$T> = keyof $T extends never ? false : true

/**
 * Check if an object has an index signature.
 *
 * Returns `true` if the object allows any string key (index signature), `false` otherwise.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = IsHasIndexType<Record<string, any>>  // true
 * type T2 = IsHasIndexType<{ [key: string]: number }>  // true
 * type T3 = IsHasIndexType<{ a: string }>  // false
 * type T4 = IsHasIndexType<{ a: string; [key: string]: any }>  // true
 * ```
 */
export type IsHasIndexType<$T> = string extends keyof $T ? true : false
