import { Str } from '@kitz/core'
import { Schema as S } from 'effect'
import { Sided } from '../property-factories/sided/_.js'

/**
 * Sided input type for padding values.
 *
 * @category Text Formatting
 */
export type Input = Sided.Input<Value>

/**
 * Padding value type.
 * - number: character count (spaces)
 * - string: literal content
 * - bigint: percentage of parent
 */
export type Value = number | string | bigint

/**
 * Padding value schema.
 */
export const Value = S.Union(S.Number, S.String, S.BigIntFromSelf)

/**
 * Padding configuration using logical properties.
 *
 * Logical properties adapt to orientation:
 * - `mainStart`/`mainEnd`: Along the flow direction
 * - `crossStart`/`crossEnd`: Perpendicular to flow
 *
 * @category Text Formatting
 */
export class Padding extends Sided.Class<Padding>('Padding')(Value) {}

/**
 * Parse padding input into a Padding instance.
 *
 * @category Text Formatting
 */
export const parse = (input: Input): Padding => Padding.make(Sided.parse(input) as any)

/**
 * One-way transformation schema: Input → Padding.
 *
 * Accepts shorthand inputs and normalizes to { mainStart?, mainEnd?, crossStart?, crossEnd? }.
 */
export const fromInput = Sided.fromInput(Value)

/**
 * Resolve a padding value to a number (character count).
 * - undefined → 0
 * - number → the number itself
 * - string → visual width of the string
 * - bigint → percentage of available span
 *
 * @param value - The padding value to resolve
 * @param availableSpan - The available span for percentage calculations (caller must resolve undefined to 0)
 */
export const resolveValue = (
  value: number | string | bigint | undefined,
  availableSpan: number,
): number => {
  if (value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Str.Visual.width(value)
  if (typeof value === 'bigint') {
    return Math.round((Number(value) / 100) * availableSpan)
  }
  return 0
}
