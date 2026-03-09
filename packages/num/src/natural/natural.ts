/**
 * Natural number brand and operations.
 * A natural number is a positive integer (1, 2, 3, ...).
 * These are the numbers used for counting things.
 */

import type { Int } from '../int/__.js'
import { is as isInt } from '../int/__.js'
import type { Positive } from '../positive/__.js'
import { is as isPositive } from '../positive/__.js'

import type { Brand } from 'effect'

/**
 * Natural number (positive integer: 1, 2, 3, ...).
 * These are the counting numbers used in everyday life.
 *
 * Natural numbers are both integers and positive, so they combine
 * both brands for maximum type safety.
 *
 * @example
 * // Valid natural numbers:
 * // 1, 2, 3, 100, 1000
 *
 * // Invalid (not natural):
 * // 0 (use Whole for non-negative integers)
 * // -1 (negative)
 * // 1.5 (not an integer)
 * // Infinity (not finite)
 */
export type Natural = number & Brand.Brand<'Natural'>

/**
 * Type predicate to check if value is a natural number.
 * Returns true for positive integers (1, 2, 3, ...).
 *
 * @param value - The value to check
 * @returns True if value is a natural number
 *
 * @example
 * is(5) // true
 * is(0) // false (zero is not natural)
 * is(-3) // false (negative)
 * is(3.14) // false (not an integer)
 * is(Infinity) // false
 */
export const is = (value: unknown): value is Natural & Int & Positive => {
  return isInt(value) && isPositive(value)
}

/**
 * Construct a Natural number.
 * Throws if the value is not a positive integer.
 *
 * @param value - The number to convert to Natural
 * @returns The value as a Natural number
 * @throws Error if value is not a positive integer
 *
 * @example
 * from(5) // 5 as Natural
 * from(1) // 1 as Natural
 *
 * // These throw errors:
 * from(0) // Error: not positive
 * from(-5) // Error: not positive
 * from(3.5) // Error: not an integer
 */
export const from = (value: number): Natural & Int & Positive => {
  if (!Number.isInteger(value)) {
    throw new Error(`Value must be an integer, got: ${value}`)
  }
  if (value <= 0) {
    throw new Error(`Value must be positive (> 0), got: ${value}`)
  }
  return value as Natural & Int & Positive
}

/**
 * Try to construct a Natural number.
 * Returns null if the value is not a positive integer.
 *
 * @param value - The number to try converting
 * @returns The Natural number or null
 *
 * @example
 * tryFrom(5) // 5 as Natural
 * tryFrom(0) // null
 * tryFrom(-3) // null
 * tryFrom(3.14) // null
 */
export const tryFrom = (value: number): (Natural & Int & Positive) | null => {
  return is(value) ? value : null
}

/**
 * Parse a string as a natural number.
 * Returns null if the string doesn't represent a positive integer.
 * Note: parseInt("1.5") returns 1, but we check if the original string
 * represents an integer by comparing with the parsed result.
 *
 * @param value - The string to parse
 * @returns The parsed natural number or null
 *
 * @example
 * parseAsNatural("5") // 5 as Natural
 * parseAsNatural("100") // 100 as Natural
 * parseAsNatural("0") // null
 * parseAsNatural("-5") // null
 * parseAsNatural("3.14") // null (contains decimal)
 * parseAsNatural("abc") // null
 */
export const parseAsNatural = (value: string): (Natural & Int & Positive) | null => {
  const parsed = parseInt(value, 10)
  // Check if parsing was successful and the string represents exactly the parsed integer
  if (!is(parsed) || parsed.toString() !== value.trim()) {
    return null
  }
  return parsed
}

/**
 * Get the next natural number.
 * For any number, returns the smallest natural number greater than the input.
 *
 * @param value - The number to get the next natural from
 * @returns The next natural number
 *
 * @example
 * next(5) // 6
 * next(5.1) // 6
 * next(5.9) // 6
 * next(0) // 1
 * next(-2.5) // 1
 */
export const next = (value: number): Natural & Int & Positive => {
  const next = Math.floor(value) + 1
  return from(Math.max(1, next))
}

/**
 * Get the previous natural number.
 * Returns null if there is no previous natural (i.e., for values <= 1).
 *
 * @param value - The number to get the previous natural from
 * @returns The previous natural number or null
 *
 * @example
 * prev(5) // 4
 * prev(5.9) // 4
 * prev(2) // 1
 * prev(1) // null (no natural before 1)
 * prev(0.5) // null
 */
export const prev = (value: number): (Natural & Int & Positive) | null => {
  // For non-integers, floor to get the integer part
  // Then check if it's a valid natural to return the previous one
  const floored = Math.floor(value)
  if (floored > 1) {
    return from(floored - 1)
  } else if (floored === 1 && value === 1) {
    // Exactly 1, no previous natural
    return null
  } else if (floored >= 1 && value > floored) {
    // Between integers, return the floored value if it's natural
    return from(floored)
  }
  return null
}
