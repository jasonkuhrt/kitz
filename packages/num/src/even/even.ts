/**
 * Even integer brand and operations.
 * An even integer is divisible by 2.
 */

import { Int as IntNs } from '../int/_.js'
import type { Int } from '../int/__.js'

import type { Brand } from 'effect'

/**
 * Even integer.
 *
 * Even integers are whole numbers that are divisible by 2.
 * They include zero and alternate with odd numbers on the number line.
 * Note: This type combines with Int brand for maximum type safety.
 *
 * @example
 * // Valid even integers:
 * // ..., -4, -2, 0, 2, 4, 6, 8, ...
 *
 * // Invalid (not even):
 * // 1, 3, 5 (odd integers)
 * // 2.5 (not an integer)
 * // Infinity (not finite)
 */
export type Even = number & Brand.Brand<'Even'>

/**
 * Type predicate to check if value is even.
 * Returns Even & Int when the value is an even integer.
 *
 * @param value - The value to check
 * @returns True if value is an even integer
 *
 * @example
 * is(4) // true
 * is(0) // true (zero is even)
 * is(-2) // true
 * is(3) // false (odd)
 * is(4.5) // false (not an integer)
 * is('4') // false (not a number)
 */
export const is = (value: unknown): value is Even & Int => {
  return IntNs.is(value) && value % 2 === 0
}

/**
 * Construct an Even integer.
 * Throws if the value is not an even integer.
 *
 * @param value - The number to convert to Even
 * @returns The value as an Even & Int
 * @throws Error if value is not an even integer
 *
 * @example
 * from(4) // 4 as Even & Int
 * from(0) // 0 as Even & Int
 * from(-2) // -2 as Even & Int
 *
 * // These throw errors:
 * from(3) // Error: Value must be even
 * from(4.5) // Error: Value must be an integer
 */
export const from = (value: number): Even & Int => {
  if (!Number.isInteger(value)) {
    throw new Error(`Value must be an integer, got: ${value}`)
  }
  if (value % 2 !== 0) {
    throw new Error(`Value must be even, got: ${value}`)
  }
  return value as Even & Int
}

/**
 * Try to construct an Even integer.
 * Returns null if the value is not an even integer.
 *
 * @param value - The number to try converting
 * @returns The Even & Int or null
 *
 * @example
 * tryFrom(4) // 4 as Even & Int
 * tryFrom(0) // 0 as Even & Int
 * tryFrom(3) // null (odd)
 * tryFrom(4.5) // null (not an integer)
 */
export const tryFrom = (value: number): (Even & Int) | null => {
  return Number.isInteger(value) && value % 2 === 0 ? (value as Even & Int) : null
}

/**
 * Get the next even number (rounds up if odd).
 * For any number, returns the smallest even integer greater than or equal to it.
 *
 * @param value - The number to get the next even from
 * @returns The next even integer
 *
 * @example
 * next(4) // 4 (already even)
 * next(5) // 6
 * next(5.1) // 6
 * next(-3) // -2
 * next(-4) // -4 (already even)
 */
export const next = (value: number): Even & Int => {
  const int = Math.ceil(value)
  return from(int % 2 === 0 ? int : int + 1)
}

/**
 * Get the previous even number (rounds down if odd).
 * For any number, returns the largest even integer less than or equal to it.
 *
 * @param value - The number to get the previous even from
 * @returns The previous even integer
 *
 * @example
 * prev(4) // 4 (already even)
 * prev(5) // 4
 * prev(5.9) // 4
 * prev(-3) // -4
 * prev(-4) // -4 (already even)
 */
export const prev = (value: number): Even & Int => {
  const int = Math.floor(value)
  return from(int % 2 === 0 ? int : int - 1)
}
