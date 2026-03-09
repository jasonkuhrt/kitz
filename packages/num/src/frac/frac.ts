/**
 * Fraction (proper fraction) brand and operations.
 * A fraction represents a positive proper fraction where 0 < numerator < denominator.
 */

import { Fn } from '@kitz/core'
import type { Int } from '../int/__.js'
import type { Natural } from '../natural/__.js'
import type { NonZero } from '../non-zero/__.js'
import type { Ratio } from '../ratio/__.js'
import * as Ratio_ from '../ratio/__.js'

import type { Brand } from 'effect'

/**
 * Fraction (proper fraction) - a positive ratio where 0 < numerator < denominator.
 *
 * Fractions represent parts of a whole, always between 0 and 1 (exclusive).
 * They're ideal for:
 * - Probabilities (1/6 for dice roll)
 * - Portions and percentages (3/4 of a pizza)
 * - UI measurements (2/3 width)
 * - Musical note durations (1/4 note, 1/8 note)
 *
 * @example
 * // Valid fractions:
 * // 1/2, 1/3, 2/3, 3/4, 5/8, 99/100
 *
 * // Invalid:
 * // 3/2 (improper), 4/4 (equals 1), 0/5 (equals 0), -1/2 (negative)
 */
export type Frac = Ratio & Brand.Brand<'Frac'>

/**
 * Type predicate to check if value is a proper fraction.
 *
 * @param value - The value to check
 * @returns True if value is a proper fraction (0 < n/d < 1)
 *
 * @example
 * is(Ratio.from(1, 2)) // true
 * is(Ratio.from(3, 4)) // true
 * is(Ratio.from(5, 3)) // false (improper: > 1)
 * is(Ratio.from(4, 4)) // false (equals 1)
 * is(Ratio.from(0, 5)) // false (equals 0)
 * is(Ratio.from(-1, 2)) // false (negative)
 */
export const is = (value: unknown): value is Frac => {
  return (
    Ratio_.is(value) &&
    value.numerator > 0 &&
    value.denominator > 0 &&
    value.numerator < value.denominator
  )
}

/**
 * Construct a Fraction from numerator and denominator.
 * Both must be positive and numerator must be less than denominator.
 *
 * @param numerator - The top number (positive, less than denominator)
 * @param denominator - The bottom number (positive, greater than numerator)
 * @returns The fraction
 * @throws Error if not a proper fraction
 *
 * @example
 * from(1, 2) // 1/2
 * from(3, 4) // 3/4
 * from(2, 3) // 2/3
 *
 * // These throw errors:
 * from(5, 3) // Error: Fraction must be less than 1
 * from(4, 4) // Error: Fraction must be less than 1
 * from(0, 5) // Error: Fraction numerator must be positive
 */
export const from = (numerator: Natural, denominator: Natural): Frac => {
  if (numerator === 0) {
    throw new Error('Fraction numerator must be positive')
  }
  if (numerator >= denominator) {
    throw new Error('Fraction must be less than 1')
  }

  return Ratio_.from(numerator as unknown as Int, denominator as unknown as NonZero) as Frac
}

/**
 * Create a function that constructs fractions with a fixed numerator.
 * Useful for creating series of fractions.
 *
 * @param numerator - The fixed numerator
 * @returns A function that creates fractions with the given numerator
 *
 * @example
 * const oneOver = fromWith(1)
 * oneOver(2) // 1/2
 * oneOver(3) // 1/3
 * oneOver(4) // 1/4
 */
export const fromWith = Fn.curry(from)

/**
 * Create a function that constructs fractions with a fixed denominator.
 * Useful for working with common denominators.
 *
 * @param denominator - The fixed denominator
 * @returns A function that creates fractions with the given denominator
 *
 * @example
 * const percentages = fromOn(100)
 * percentages(25) // 25/100 = 1/4
 * percentages(50) // 50/100 = 1/2
 * percentages(75) // 75/100 = 3/4
 */
export const fromOn = Fn.flipCurried(Fn.curry(from))

/**
 * Try to construct a Fraction.
 * Returns null if not a proper fraction.
 *
 * @param numerator - The top number
 * @param denominator - The bottom number
 * @returns The fraction or null
 *
 * @example
 * tryFrom(1, 2) // 1/2 as Frac
 * tryFrom(3, 4) // 3/4 as Frac
 * tryFrom(5, 3) // null (improper)
 * tryFrom(0, 5) // null (zero)
 */
export const tryFrom = (numerator: Natural, denominator: Natural): Frac | null => {
  if (numerator === 0 || numerator >= denominator) {
    return null
  }

  return Ratio_.from(numerator as unknown as Int, denominator as unknown as NonZero) as Frac
}

/**
 * Convert a decimal to a fraction.
 * The decimal must be between 0 and 1 (exclusive).
 *
 * @param value - The decimal value (0 < value < 1)
 * @param maxDenominator - Maximum denominator to use (default: 100)
 * @returns The fraction approximation
 * @throws Error if value is not between 0 and 1
 *
 * @example
 * fromDecimal(0.5) // 1/2
 * fromDecimal(0.25) // 1/4
 * fromDecimal(0.333) // 1/3 (recognizes repeating decimals)
 * fromDecimal(0.125) // 1/8
 *
 * // Percentages to fractions:
 * fromDecimal(0.75) // 3/4 (75%)
 * fromDecimal(0.08) // 2/25 (8%)
 */
export const fromDecimal = (value: number, maxDenominator: number = 100): Frac => {
  if (value <= 0 || value >= 1) {
    throw new Error('Value must be between 0 and 1 (exclusive)')
  }

  const ratio = Ratio_.fromDecimal(value, maxDenominator)
  if (!is(ratio)) {
    throw new Error('Could not convert decimal to proper fraction')
  }

  return ratio
}

/**
 * Convert fraction to decimal.
 *
 * @param frac - The fraction to convert
 * @returns The decimal value (between 0 and 1)
 *
 * @example
 * toDecimal(from(1, 2)) // 0.5
 * toDecimal(from(1, 4)) // 0.25
 * toDecimal(from(2, 3)) // 0.6666666666666666
 * toDecimal(from(3, 8)) // 0.375
 */
export const toDecimal = (frac: Frac): number => {
  return Ratio_.toDecimal(frac)
}

/**
 * Convert fraction to percentage.
 *
 * @param frac - The fraction to convert
 * @returns The percentage value (0-100)
 *
 * @example
 * toPercentage(from(1, 2)) // 50
 * toPercentage(from(1, 4)) // 25
 * toPercentage(from(3, 4)) // 75
 * toPercentage(from(1, 3)) // 33.33333333333333
 */
export const toPercentage = (frac: Frac): number => {
  return Ratio_.toDecimal(frac) * 100
}

/**
 * Get the complement of a fraction (1 - fraction).
 *
 * @param frac - The fraction
 * @returns The complement as a fraction
 *
 * @example
 * complement(from(1, 4)) // 3/4
 * complement(from(2, 3)) // 1/3
 * complement(from(3, 5)) // 2/5
 *
 * // Probability: If P(A) = 1/3, then P(not A) = 2/3
 * const pSuccess = from(1, 3)
 * const pFailure = complement(pSuccess) // 2/3
 */
export const complement = (frac: Frac): Frac => {
  const one = Ratio_.from(1 as Int, 1 as NonZero)
  const result = Ratio_.subtract(one, frac)

  // We know the result is a proper fraction because 0 < frac < 1
  return result as Frac
}

/**
 * Add two fractions.
 * Note: The result might not be a fraction if the sum >= 1.
 *
 * @param a - First fraction
 * @param b - Second fraction
 * @returns The sum as a Ratio (might be >= 1)
 *
 * @example
 * add(from(1, 4), from(1, 4)) // 1/2 (still a fraction)
 * add(from(1, 3), from(1, 3)) // 2/3 (still a fraction)
 * add(from(2, 3), from(2, 3)) // 4/3 (not a fraction, returns Ratio)
 *
 * // Combining probabilities (if mutually exclusive):
 * const pRed = from(1, 6)    // 1/6 chance
 * const pBlue = from(1, 3)   // 1/3 chance
 * const pRedOrBlue = add(pRed, pBlue) // 1/2 chance
 */
export const add = (a: Frac, b: Frac): Ratio => {
  return Ratio_.add(a, b)
}

/**
 * Create a function that adds to a specific fraction.
 * Data-first pattern: fix the first argument.
 *
 * @param a - The base fraction
 * @returns A function that adds its input to the base fraction
 *
 * @example
 * const addToHalf = addOn(from(1, 2))
 * addToHalf(from(1, 4)) // 3/4
 * addToHalf(from(1, 3)) // 5/6
 */
export const addOn = Fn.curry(add)

/**
 * Create a function that adds with a specific fraction.
 * Data-second pattern: fix the second argument.
 *
 * @param b - The fraction to add
 * @returns A function that adds the fraction to its input
 *
 * @example
 * const addQuarter = addWith(from(1, 4))
 * addQuarter(from(1, 4)) // 1/2
 * addQuarter(from(1, 2)) // 3/4
 */
export const addWith = Fn.flipCurried(Fn.curry(add))

/**
 * Multiply two fractions.
 * The result is always a fraction (product of two numbers < 1 is < 1).
 *
 * @param a - First fraction
 * @param b - Second fraction
 * @returns The product as a fraction
 *
 * @example
 * multiply(from(1, 2), from(1, 2)) // 1/4
 * multiply(from(2, 3), from(3, 4)) // 1/2
 * multiply(from(3, 4), from(4, 5)) // 3/5
 *
 * // Probability: P(A and B) for independent events
 * const pHeads = from(1, 2)
 * const pSix = from(1, 6)
 * const pBoth = multiply(pHeads, pSix) // 1/12
 */
export const multiply = (a: Frac, b: Frac): Frac => {
  // Product of two proper fractions is always a proper fraction
  return Ratio_.multiply(a, b) as Frac
}

/**
 * Create a function that multiplies a specific fraction.
 * Data-first pattern: fix the first argument.
 *
 * @param a - The base fraction
 * @returns A function that multiplies the base fraction by its input
 *
 * @example
 * const multiplyHalf = multiplyOn(from(1, 2))
 * multiplyHalf(from(1, 3)) // 1/6
 * multiplyHalf(from(3, 4)) // 3/8
 */
export const multiplyOn = Fn.curry(multiply)

/**
 * Create a function that multiplies with a specific fraction.
 * Data-second pattern: fix the second argument.
 *
 * @param b - The fraction to multiply with
 * @returns A function that multiplies its input with the fraction
 *
 * @example
 * const half = multiplyWith(from(1, 2))
 * half(from(1, 3)) // 1/6
 * half(from(3, 4)) // 3/8
 */
export const multiplyWith = Fn.flipCurried(Fn.curry(multiply))

/**
 * Compare two fractions.
 *
 * @param a - First fraction
 * @param b - Second fraction
 * @returns -1 if a < b, 0 if a = b, 1 if a > b
 *
 * @example
 * compare(from(1, 3), from(1, 2)) // -1 (1/3 < 1/2)
 * compare(from(2, 3), from(2, 3)) // 0 (equal)
 * compare(from(3, 4), from(2, 3)) // 1 (3/4 > 2/3)
 */
export const compare = (a: Frac, b: Frac): -1 | 0 | 1 => {
  return Ratio_.compare(a, b)
}

/**
 * Create a function that compares a specific fraction.
 * Data-first pattern: fix the first argument.
 *
 * @param a - The base fraction
 * @returns A function that compares the base fraction with its input
 *
 * @example
 * const compareHalf = compareOn(from(1, 2))
 * compareHalf(from(1, 3)) // 1 (1/2 > 1/3)
 * compareHalf(from(2, 3)) // -1 (1/2 < 2/3)
 */
export const compareOn = Fn.curry(compare)

/**
 * Create a function that compares with a specific fraction.
 * Data-second pattern: fix the second argument.
 *
 * @param b - The fraction to compare against
 * @returns A function that compares its input with the fraction
 *
 * @example
 * const compareToHalf = compareWith(from(1, 2))
 * compareToHalf(from(1, 3)) // -1 (1/3 < 1/2)
 * compareToHalf(from(2, 3)) // 1 (2/3 > 1/2)
 */
export const compareWith = Fn.flipCurried(Fn.curry(compare))
