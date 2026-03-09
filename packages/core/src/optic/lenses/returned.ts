import type { Fn } from '#fn'
import type { ValidateAndExtract } from '../core.js'

type FnConstraint = (...args: any[]) => any

/**
 * Get the return type from a function.
 *
 * @example
 * ```ts
 * type T = Get<() => string> // string
 * ```
 */
export type Get<$T> = ValidateAndExtract<
  $T,
  FnConstraint,
  'returned',
  ReturnType<Extract<$T, FnConstraint>>
>

/**
 * Set the return type of a function.
 *
 * @example
 * ```ts
 * type T = Set<() => string, number> // () => number
 * ```
 */
export type Set<$T, $New> = $T extends (...args: infer __args__) => any
  ? (...args: __args__) => $New
  : never

/**
 * HKT for Get operation.
 */
export interface $Get extends Fn.Kind.Kind {
  constraint: FnConstraint
  lensName: 'returned'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0]>
}

/**
 * HKT for Set operation.
 */
export interface $Set extends Fn.Kind.Kind {
  constraint: FnConstraint
  lensName: 'returned'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], this['parameters'][1]>
}
