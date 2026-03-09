import type { Fn } from '#fn'
import type { LensErrorTupleExtract, ValidateAndExtract } from '../core.js'
import type { ReplaceAt } from './parameter-helpers.js'

type TupleConstraint = readonly any[]

/**
 * Get an element by index from a tuple.
 *
 * @example
 * ```ts
 * type T = Get<[string, number, boolean], 1> // number
 * ```
 */
export type Get<$T, $Index extends number> = ValidateAndExtract<
  $T,
  TupleConstraint,
  'tuple',
  $T extends readonly any[] ? $T[$Index] : LensErrorTupleExtract<$T>
>

/**
 * Set an element by index in a tuple.
 *
 * @example
 * ```ts
 * type T = Set<[string, number, boolean], 1, symbol> // [string, symbol, boolean]
 * ```
 */
export type Set<$T, $Index extends number, $New> = $T extends readonly any[]
  ? ReplaceAt<$T, $Index, $New>
  : never

/**
 * HKT for Get operation (parameterized by index).
 */
export interface $Get<$Index extends number> extends Fn.Kind.Kind {
  constraint: TupleConstraint
  lensName: 'tuple'
  parameters: [$T: unknown]
  return: Get<this['parameters'][0], $Index>
}

/**
 * HKT for Set operation (parameterized by index).
 */
export interface $Set<$Index extends number> extends Fn.Kind.Kind {
  constraint: TupleConstraint
  lensName: 'tuple'
  parameters: [$T: unknown, $New: unknown]
  return: Set<this['parameters'][0], $Index, this['parameters'][1]>
}
