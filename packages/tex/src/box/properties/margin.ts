import { Str } from '@kitz/core'
import { Schema as S } from 'effect'
import { Sided } from '../property-factories/sided/_.js'

/**
 * Margin value type.
 * - number: character count (spaces)
 * - string: literal content
 * - bigint: percentage of parent
 */
export type Value = number | string | bigint

/**
 * Sided input type for margin values.
 *
 * @category Text Formatting
 */
export type Input = Sided.Input<Value>

/**
 * Margin value schema.
 */
export const ValueSchema = S.Union([S.Number, S.String, S.BigInt])

/**
 * Margin configuration using logical properties.
 *
 * Logical properties adapt to orientation (same as Padding).
 *
 * @category Text Formatting
 */
export class Margin extends Sided.Class<Margin>('Margin')(ValueSchema) {}

/**
 * Parse margin input into a Margin instance.
 *
 * @category Text Formatting
 */
export const parse = (input: Input): Margin => new Margin(Sided.parse(input) as any)

/**
 * One-way transformation schema: Input → Margin.
 *
 * Accepts shorthand inputs and normalizes to { mainStart?, mainEnd?, crossStart?, crossEnd? }.
 */
export const fromInput = Sided.fromInput(ValueSchema)

/**
 * Resolve a margin value to a number (character count).
 * - undefined → 0
 * - number → the number itself
 * - string → visual width of the string
 * - bigint → percentage of available span
 *
 * @param value - The margin value to resolve
 * @param availableSpan - The available span for percentage calculations (caller must resolve undefined to 0)
 */
export const resolveValue = (
  value: number | string | bigint | undefined,
  availableSpan: number,
): number => {
  if (value === undefined) return 0
  if (typeof value === `number`) return value
  if (typeof value === `string`) return Str.Visual.width(value)
  if (typeof value === `bigint`) {
    return Math.round((Number(value) / 100) * availableSpan)
  }
  return 0
}
