import type { Fn } from '#fn'
import type { ValidateAndExtract } from '../core.js'

/**
 * Get the awaited type from a Promise.
 *
 * @example
 * ```ts
 * type T = Get<Promise<string>> // string
 * ```
 */
export type Get<$T> = ValidateAndExtract<$T, PromiseLike<any>, 'awaited', Awaited<$T>>

/**
 * Set the awaited type of a Promise.
 *
 * @example
 * ```ts
 * type T = Set<Promise<string>, number> // Promise<number>
 * ```
 */
export type Set<$T, $New> = $T extends PromiseLike<any> ? Promise<$New> : never

/**
 * HKT for Get operation.
 */
export interface $Get extends Fn.Kind.Kind {
  constraint: PromiseLike<any>
  lensName: 'awaited'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0]>
}

/**
 * HKT for Set operation.
 */
export interface $Set extends Fn.Kind.Kind {
  constraint: PromiseLike<any>
  lensName: 'awaited'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], this['parameters'][1]>
}
