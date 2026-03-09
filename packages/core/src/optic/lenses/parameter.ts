import type { Fn } from '#fn'
import type { ValidateAndExtract } from '../core.js'
import type { ReplaceAt } from './parameter-helpers.js'

type FnConstraint = (...args: any[]) => any

/**
 * Get a specific parameter by index from a function.
 *
 * @example
 * ```ts
 * type T = Get<(a: string, b: number) => void, 1> // number
 * ```
 */
export type Get<$T, $Index extends number> = ValidateAndExtract<
  $T,
  FnConstraint,
  'parameter',
  Parameters<Extract<$T, FnConstraint>>[$Index]
>

/**
 * Set a specific parameter by index in a function.
 *
 * @example
 * ```ts
 * type T = Set<(a: string, b: number) => void, 0, boolean> // (a: boolean, b: number) => void
 * ```
 */
export type Set<$T, $Index extends number, $New> = $T extends (
  ...args: infer __args__
) => infer __return__
  ? (...args: ReplaceAt<__args__, $Index, $New>) => __return__
  : never

/**
 * HKT for Get operation.
 */
export interface $Get<$Index extends number> extends Fn.Kind.Kind {
  constraint: FnConstraint
  lensName: 'parameter'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0], $Index>
}

/**
 * HKT for Set operation.
 */
export interface $Set<$Index extends number> extends Fn.Kind.Kind {
  constraint: FnConstraint
  lensName: 'parameter'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], $Index, this['parameters'][1]>
}
