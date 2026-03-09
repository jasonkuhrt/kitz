import type { Fn } from '#fn'
import type { Ts } from '#ts'
import type { Either } from 'effect'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Error Types
//
//
//
//

/**
 * Error when property key does not exist on type.
 */
export type LensErrorPropertyNotFound<$Key extends PropertyKey, $Actual> = Ts.Err.StaticError<
  ['lens', 'property', 'not-found'],
  { message: 'Property does not exist on type'; key: $Key; actual: $Actual }
>

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type-Level Operations
//
//
//
//

/**
 * Get a property value from an object type.
 *
 * @example
 * ```ts
 * type T = Get<'name', { name: string; age: number }> // Either.Right<never, string>
 * type E = Get<'foo', { name: string }> // Either.Left<error, never>
 * ```
 */
// oxfmt-ignore
export type Get<$Key extends PropertyKey, $T> =
  $Key extends keyof $T
    ? Either.Right<never, $T[$Key]>
    : Either.Left<LensErrorPropertyNotFound<$Key, $T>, never>

/**
 * Set a property value in an object type.
 *
 * @example
 * ```ts
 * type T = Set<'name', { name: string }, number> // { name: number }
 * ```
 */
// oxfmt-ignore
export type Set<$Key extends PropertyKey, $T, $New> =
  $Key extends keyof $T
    ? { [k in keyof $T]: k extends $Key ? $New : $T[k] }
    : never

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • HKT Interfaces
//
//
//
//

/**
 * HKT for Get operation (parameterized by property key).
 */
export interface $Get<$Key extends PropertyKey> extends Fn.Kind.Kind {
  constraint: Record<$Key, unknown>
  lensName: 'property'
  key: $Key
  parameters: [$T: unknown]
  return: Get<$Key, this['parameters'][0]>
}

/**
 * HKT for Set operation (parameterized by property key).
 */
export interface $Set<$Key extends PropertyKey> extends Fn.Kind.Kind {
  constraint: Record<$Key, unknown>
  lensName: 'property'
  key: $Key
  parameters: [$T: unknown, $New: unknown]
  return: Set<$Key, this['parameters'][0], this['parameters'][1]>
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime
//
//
//
//

/**
 * Create a property getter lens.
 *
 * @example
 * ```ts
 * const getName = get('name')
 * getName({ name: 'Alice' }) // 'Alice'
 * ```
 */
export const get =
  <$Key extends PropertyKey>(key: $Key) =>
  <$T extends Record<$Key, unknown>>(obj: $T): $T[$Key] =>
    obj[key]
