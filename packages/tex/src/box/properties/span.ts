import { Schema as S } from 'effect'
import { Axied } from '../property-factories/axied/_.js'

/**
 * Span value type.
 * - number: size in characters
 * - string: size equals string.length
 * - bigint: percentage of parent
 */
export type Value = number | string | bigint

/**
 * Span value schema.
 */
export const ValueSchema = S.Union([S.Number, S.String, S.BigInt])

/**
 * Axied input type for span values.
 *
 * @category Text Formatting
 */
export type Input = Axied.Input<Value>

/**
 * Span configuration using logical properties.
 *
 * @category Text Formatting
 */
export class Span extends Axied.Class<Span>('Span')(ValueSchema) {
  static make = this.makeUnsafe
}

/**
 * Parse span input into a Span instance.
 *
 * @category Text Formatting
 */
export const parse = (input: Input): Span => Span.make(Axied.parse(input) as any)

/**
 * One-way transformation schema: Input → Span.
 *
 * Accepts shorthand inputs (value, tuple, or object) and normalizes to { main?, cross? }.
 */
export const fromInput = Axied.fromInput(ValueSchema)
