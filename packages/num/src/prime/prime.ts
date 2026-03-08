/**
 * Prime number brand and operations.
 * A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself.
 */

import type { Natural } from '../natural/__.js'

import type { Brand } from 'effect'

/**
 * Prime number (natural number > 1 with no divisors except 1 and itself).
 *
 * Prime numbers are fundamental in mathematics and essential for:
 * - Cryptography (RSA keys, Diffie-Hellman)
 * - Hash table sizing (reduces collisions)
 * - Random number generation
 * - Number theory algorithms
 *
 * @example
 * // Valid prime numbers:
 * // 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37...
 *
 * // Invalid (not prime):
 * // 1 (by definition), 4, 6, 8, 9, 10, 12...
 */
export type Prime = Natural & Brand.Brand<'Prime'>

/**
 * Type predicate to check if value is a prime number.
 * Uses trial division optimization up to sqrt(n).
 *
 * @param value - The value to check
 * @returns True if value is a prime number
 *
 * @example
 * is(2) // true (smallest prime)
 * is(17) // true
 * is(100) // false (divisible by 2, 4, 5, 10, 20, 25, 50)
 * is(1) // false (not prime by definition)
 */
export const is = (value: unknown): value is Prime => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 1) {
    return false
  }

  if (value === 2) return true
  if (value % 2 === 0) return false

  const sqrt = Math.sqrt(value)
  for (let i = 3; i <= sqrt; i += 2) {
    if (value % i === 0) return false
  }

  return true
}

/**
 * Construct a Prime number.
 * Throws if the value is not prime.
 *
 * @param value - The number to convert to Prime
 * @returns The value as a Prime number
 * @throws Error if value is not prime
 *
 * @example
 * from(2) // 2 as Prime
 * from(17) // 17 as Prime
 * from(23) // 23 as Prime
 *
 * // These throw errors:
 * from(1) // Error: Value must be prime, 1 is not prime by definition
 * from(4) // Error: Value must be prime, 4 is divisible by 2
 */
export const from = (value: Natural): Prime => {
  if (!is(value)) {
    if (value === 1) {
      throw new Error('Value must be prime, 1 is not prime by definition')
    }
    throw new Error(`Value must be prime, ${value} is not prime`)
  }
  return value
}

/**
 * Try to construct a Prime number.
 * Returns null if the value is not prime.
 *
 * @param value - The number to try converting
 * @returns The Prime number or null
 *
 * @example
 * tryFrom(17) // 17 as Prime
 * tryFrom(4) // null
 * tryFrom(1) // null
 */
export const tryFrom = (value: Natural): Prime | null => {
  return is(value) ? value : null
}

/**
 * Find the next prime number after the given value.
 *
 * @param value - Starting point (exclusive)
 * @returns The next prime number
 *
 * @example
 * next(10) // 11
 * next(11) // 13
 * next(14) // 17
 *
 * // Useful for hash table sizing:
 * const tableSize = next(estimatedSize)
 */
export const next = (value: number): Prime => {
  let candidate = Math.floor(value) + 1
  if (candidate <= 2) return 2 as Prime

  // Ensure odd
  if (candidate % 2 === 0) candidate++

  while (!is(candidate)) {
    candidate += 2
  }

  return candidate
}

/**
 * Find the previous prime number before the given value.
 * Returns null if no prime exists before the value (i.e., value <= 2).
 *
 * @param value - Starting point (exclusive)
 * @returns The previous prime number or null
 *
 * @example
 * prev(10) // 7
 * prev(8) // 7
 * prev(3) // 2
 * prev(2) // null (no prime before 2)
 */
export const prev = (value: number): Prime | null => {
  let candidate = Math.floor(value) - 1
  if (candidate < 2) return null
  if (candidate === 2) return 2 as Prime

  // Ensure odd
  if (candidate % 2 === 0) candidate--

  while (candidate >= 3 && !is(candidate)) {
    candidate -= 2
  }

  return candidate >= 2 ? (candidate as Prime) : null
}

/**
 * Get the nth prime number (1-indexed).
 * Uses a simple sieve for small n, trial division for larger.
 *
 * @param n - Which prime to get (1 = first prime = 2)
 * @returns The nth prime number
 * @throws Error if n < 1
 *
 * @example
 * nth(1) // 2 (first prime)
 * nth(10) // 29 (tenth prime)
 * nth(100) // 541 (hundredth prime)
 *
 * // Generate sequence of primes:
 * const first10Primes = Array.from({length: 10}, (_, i) => nth(i + 1))
 * // [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
 */
export const nth = (n: Natural): Prime => {
  if (n < 1) {
    throw new Error('n must be at least 1')
  }

  if (n === 1) return 2 as Prime

  let count = 1
  let candidate = 3

  while (count < n) {
    if (is(candidate)) {
      count++
      if (count === n) return candidate
    }
    candidate += 2
  }

  return candidate as Prime
}

/**
 * Prime factorization of a number.
 * Returns a map of prime factors to their exponents.
 *
 * @param value - The number to factorize (must be >= 2)
 * @returns Map of prime factors to exponents
 * @throws Error if value < 2
 *
 * @example
 * factorize(12) // Map { 2 => 2, 3 => 1 } (12 = 2² × 3¹)
 * factorize(60) // Map { 2 => 2, 3 => 1, 5 => 1 } (60 = 2² × 3¹ × 5¹)
 * factorize(17) // Map { 17 => 1 } (17 is prime)
 *
 * // Use for LCM/GCD calculations:
 * const factors = factorize(360)
 * // Map { 2 => 3, 3 => 2, 5 => 1 } (360 = 2³ × 3² × 5¹)
 */
export const factorize = (value: Natural): Map<Prime, Natural> => {
  if (value < 2) {
    throw new Error('Cannot factorize numbers less than 2')
  }

  const factors = new Map<Prime, Natural>()
  let n: number = value

  // Check 2 separately
  let count = 0
  while (n % 2 === 0) {
    count++
    n = Math.floor(n / 2)
  }
  if (count > 0) {
    factors.set(2 as Prime, count as Natural)
  }

  // Check odd factors
  let factor = 3
  while (factor * factor <= n) {
    count = 0
    while (n % factor === 0) {
      count++
      n = Math.floor(n / factor)
    }
    if (count > 0) {
      factors.set(factor as Prime, count as Natural)
    }
    factor += 2
  }

  // If n > 1, then it's a prime factor
  if (n > 1) {
    factors.set(n as unknown as Prime, 1 as Natural)
  }

  return factors
}
