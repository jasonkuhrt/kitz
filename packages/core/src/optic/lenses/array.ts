import type { Fn } from '#fn'
import type { LensErrorArrayExtract, ValidateAndExtract } from '../core.js'

type ArrayConstraint = readonly any[]

/**
 * Get the element type from an array.
 *
 * @example
 * ```ts
 * type T = Get<string[]> // string
 * ```
 */
export type Get<$T> = ValidateAndExtract<
  $T,
  ArrayConstraint,
  'array',
  $T extends readonly (infer __element__)[] ? __element__ : LensErrorArrayExtract<$T>
>

/**
 * Set the element type of an array.
 *
 * @example
 * ```ts
 * type T = Set<string[], number> // number[]
 * type T2 = Set<readonly string[], number> // readonly number[]
 * ```
 */
// oxfmt-ignore
export type Set<$T, $New> =
  $T extends readonly any[]
    ? $T extends any[]
      ? $New[]
      : readonly $New[]
    : never

/**
 * HKT for Get operation.
 */
export interface $Get extends Fn.Kind.Kind {
  constraint: ArrayConstraint
  lensName: 'array'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0]>
}

/**
 * HKT for Set operation.
 */
export interface $Set extends Fn.Kind.Kind {
  constraint: ArrayConstraint
  lensName: 'array'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], this['parameters'][1]>
}
