/**
 * Whole number brand and operations.
 * A whole number is a non-negative integer (0, 1, 2, 3, ...).
 * These include zero and all the natural numbers.
 */

import type { Int } from '../int/__.js'
import { is as isInt } from '../int/__.js'
import type { NonNegative } from '../non-negative/__.js'
import { is as isNonNegative } from '../non-negative/__.js'

import type { Brand } from 'effect'

/**
 * Whole number (non-negative integer: 0, 1, 2, 3, ...).
 * These are the natural numbers plus zero.
 *
 * Whole numbers are both integers and non-negative, so they combine
 * both brands for maximum type safety.
 *
 * @example
 * // Valid whole numbers:
 * // 0, 1, 2, 3, 100, 1000
 *
 * // Invalid (not whole):
 * // -1 (negative)
 * // 1.5 (not an integer)
 * // Infinity (not finite)
 */
export type Whole = number & Brand.Brand<'Whole'>

/**
 * Type predicate to check if value is a whole number.
 * Returns true for non-negative integers (0, 1, 2, 3, ...).
 *
 * @param value - The value to check
 * @returns True if value is a whole number
 *
 * @example
 * is(5) // true
 * is(0) // true (zero is whole)
 * is(-3) // false (negative)
 * is(3.14) // false (not an integer)
 * is(Infinity) // false
 */
export const is = (value: unknown): value is Whole & Int & NonNegative => {
  return isInt(value) && isNonNegative(value)
}

/**
 * Construct a Whole number.
 * Throws if the value is not a non-negative integer.
 *
 * @param value - The number to convert to Whole
 * @returns The value as a Whole number
 * @throws Error if value is not a non-negative integer
 *
 * @example
 * from(5) // 5 as Whole
 * from(0) // 0 as Whole
 *
 * // These throw errors:
 * from(-5) // Error: not non-negative
 * from(3.5) // Error: not an integer
 */
export const from = (value: number): Whole & Int & NonNegative => {
  if (!Number.isInteger(value)) {
    throw new Error(`Value must be an integer, got: ${value}`)
  }
  if (value < 0) {
    throw new Error(`Value must be non-negative (>= 0), got: ${value}`)
  }
  return value as Whole & Int & NonNegative
}

/**
 * Try to construct a Whole number.
 * Returns null if the value is not a non-negative integer.
 *
 * @param value - The number to try converting
 * @returns The Whole number or null
 *
 * @example
 * tryFrom(5) // 5 as Whole
 * tryFrom(0) // 0 as Whole
 * tryFrom(-3) // null
 * tryFrom(3.14) // null
 */
export const tryFrom = (value: number): (Whole & Int & NonNegative) | null => {
  return is(value) ? value : null
}

/**
 * Parse a string as a whole number.
 * Returns null if the string doesn't represent a non-negative integer.
 *
 * @param value - The string to parse
 * @returns The parsed whole number or null
 *
 * @example
 * parseAsWhole("5") // 5 as Whole
 * parseAsWhole("0") // 0 as Whole
 * parseAsWhole("-5") // null
 * parseAsWhole("3.14") // null
 * parseAsWhole("abc") // null
 */
export const parseAsWhole = (value: string): (Whole & Int & NonNegative) | null => {
  const parsed = parseInt(value, 10)
  // Check if the string represents exactly the parsed integer
  return is(parsed) && parsed.toString() === value ? parsed : null
}

/**
 * Get the next whole number.
 * For any number, returns the smallest whole number greater than the input.
 *
 * @param value - The number to get the next whole from
 * @returns The next whole number
 *
 * @example
 * next(5) // 6
 * next(5.1) // 6
 * next(5.9) // 6
 * next(-1) // 0
 * next(-2.5) // 0
 */
export const next = (value: number): Whole & Int & NonNegative => {
  const next = Math.floor(value) + 1
  return from(Math.max(0, next))
}

/**
 * Get the previous whole number.
 * Returns null if there is no previous whole (i.e., for values <= 0).
 *
 * @param value - The number to get the previous whole from
 * @returns The previous whole number or null
 *
 * @example
 * prev(5) // 4
 * prev(5.9) // 4
 * prev(1) // 0
 * prev(0) // null (no whole before 0)
 * prev(-0.5) // null
 */
export const prev = (value: number): (Whole & Int & NonNegative) | null => {
  // Get the largest whole number less than the value
  const prev = Math.floor(value) - 1
  return prev >= 0 ? from(prev) : null
}
