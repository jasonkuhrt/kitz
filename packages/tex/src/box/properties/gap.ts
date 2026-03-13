import { Schema as S } from 'effect'
import { Axied } from '../property-factories/axied/_.js'

/**
 * Gap value type.
 * - number: character count
 * - string: literal separator
 * - bigint: percentage of parent
 */
export type Value = number | string | bigint

/**
 * Gap value schema.
 */
export const ValueSchema = S.Union([S.Number, S.String, S.BigInt])

/**
 * Axied input type for gap values.
 *
 * @category Text Formatting
 */
export type Input = Axied.Input<Value>

/**
 * Gap configuration using logical properties.
 *
 * Defines space between array items (container property):
 * - Vertical orientation: main=newlines between items, cross=spaces between items
 * - Horizontal orientation: main=spaces between items, cross=newlines between items
 *
 * @category Text Formatting
 */
export class Gap extends Axied.Class<Gap>('Gap')(ValueSchema) {
  static make = this.makeUnsafe
}

/**
 * Parse gap input into a Gap instance.
 *
 * @category Text Formatting
 */
export const parse = (input: Input): Gap => Gap.make(Axied.parse(input) as any)

/**
 * One-way transformation schema: Input → Gap.
 *
 * Accepts shorthand inputs (value, tuple, or object) and normalizes to { main?, cross? }.
 */
export const fromInput = Axied.fromInput(ValueSchema)
