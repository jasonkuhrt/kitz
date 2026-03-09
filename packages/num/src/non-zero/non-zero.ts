/**
 * Non-zero number brand and operations.
 * A non-zero number is any number except zero.
 */

import type { Brand } from 'effect'

/**
 * Non-zero number (≠ 0).
 *
 * Non-zero numbers are all numbers except zero. They are essential
 * for safe division operations and other mathematical contexts where
 * zero would cause errors or undefined behavior.
 *
 * @example
 * // Valid non-zero numbers:
 * // -100, -1, -0.1, 0.1, 1, 100, Infinity, -Infinity
 *
 * // Invalid (zero):
 * // 0, -0 (negative zero is still zero)
 *
 * // Invalid (not a number):
 * // NaN
 */
export type NonZero = number & Brand.Brand<'NonZero'>

/**
 * Type predicate to check if value is non-zero.
 *
 * @param value - The value to check
 * @returns True if value is a non-zero number
 *
 * @example
 * is(5) // true
 * is(-5) // true
 * is(0.1) // true
 * is(0) // false
 * is(-0) // false (negative zero is still zero)
 * is(NaN) // false
 * is('5') // false (not a number)
 */
export const is = (value: unknown): value is NonZero => {
  return typeof value === 'number' && value !== 0
}

/**
 * Construct a NonZero number.
 * Throws if the value is zero.
 *
 * @param value - The number to convert to NonZero
 * @returns The value as a NonZero number
 * @throws Error if value is zero
 *
 * @example
 * from(5) // 5 as NonZero
 * from(-5) // -5 as NonZero
 * from(0.1) // 0.1 as NonZero
 *
 * // These throw errors:
 * from(0) // Error: Value must be non-zero
 * from(-0) // Error: Value must be non-zero
 */
export const from = (value: number): NonZero => {
  if (value === 0) {
    throw new Error(`Value must be non-zero, got: ${value}`)
  }
  return value as NonZero
}

/**
 * Try to construct a NonZero number.
 * Returns null if the value is zero.
 *
 * @param value - The number to try converting
 * @returns The NonZero number or null
 *
 * @example
 * tryFrom(5) // 5 as NonZero
 * tryFrom(-5) // -5 as NonZero
 * tryFrom(0) // null
 * tryFrom(-0) // null
 */
export const tryFrom = (value: number): NonZero | null => {
  return value !== 0 ? (value as NonZero) : null
}

/**
 * Safely divide a number by a NonZero divisor.
 * This operation is guaranteed to never throw.
 *
 * @param dividend - The number to divide
 * @param divisor - The NonZero divisor
 * @returns The result of the division
 *
 * @example
 * const divisor = from(2) // NonZero
 * safeDivide(10, divisor) // 5
 * safeDivide(7, divisor) // 3.5
 */
export const safeDivide = (dividend: number, divisor: NonZero): number => {
  return dividend / divisor
}

/**
 * Try to divide two numbers safely.
 * Returns null if the divisor is zero.
 *
 * @param dividend - The number to divide
 * @param divisor - The divisor (may be zero)
 * @returns The result of the division or null
 *
 * @example
 * safeDiv(10, 2) // 5
 * safeDiv(10, 0) // null
 * safeDiv(0, 5) // 0
 * safeDiv(10, -2) // -5
 */
export const safeDiv = (dividend: number, divisor: number): number | null => {
  if (divisor === 0 || !Number.isFinite(divisor) || !Number.isFinite(dividend)) {
    return null
  }
  return dividend / divisor
}

/**
 * Create a function that safely divides a fixed dividend by any divisor.
 *
 * @param dividend - The fixed dividend
 * @returns A function that divides the dividend by its input
 *
 * @example
 * const divide10By = safeDivOn(10)
 * divide10By(2) // 5
 * divide10By(0) // null
 * divide10By(-5) // -2
 */
export const safeDivOn =
  (dividend: number) =>
  (divisor: number): number | null => {
    return safeDiv(dividend, divisor)
  }

/**
 * Create a function that safely divides any dividend by a fixed divisor.
 *
 * @param divisor - The fixed divisor
 * @returns A function that divides its input by the divisor
 *
 * @example
 * const halve = safeDivWith(2)
 * halve(10) // 5
 * halve(7) // 3.5
 *
 * const divideByZero = safeDivWith(0)
 * divideByZero(10) // null (always null for zero divisor)
 */
export const safeDivWith =
  (divisor: number) =>
  (dividend: number): number | null => {
    return safeDiv(dividend, divisor)
  }
