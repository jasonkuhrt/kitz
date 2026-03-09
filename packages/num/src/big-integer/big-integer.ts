/**
 * BigInteger brand and operations.
 * Wraps JavaScript's native BigInt with branded type safety and functional operations.
 */

import { Fn } from '@kitz/core'

import type { Brand } from 'effect'

/**
 * BigInteger - arbitrary precision integer with branded type safety.
 *
 * Provides exact arithmetic for integers of any size, without the limitations
 * of JavaScript's Number type (which loses precision beyond 2^53-1).
 *
 * Common uses:
 * - **Cryptography**: Large prime numbers, key generation, modular arithmetic
 * - **Financial systems**: Precise monetary calculations without rounding errors
 * - **Mathematical computing**: Factorials, combinatorics, number theory
 * - **Blockchain**: Transaction values, block numbers, hash computations
 * - **Scientific computing**: Large dataset indexing, ID generation
 *
 * @example
 * // Large numbers that exceed JavaScript's safe integer limit
 * const safe = BigInteger.from(Number.MAX_SAFE_INTEGER) // 9007199254740991n
 * const unsafe = BigInteger.from(Number.MAX_SAFE_INTEGER + 1) // 9007199254740992n
 *
 * // Factorial of large numbers
 * const factorial20 = BigInteger.from('2432902008176640000') // 20!
 *
 * // Cryptographic applications
 * const rsaModulus = BigInteger.from('115792089237316195423570985008687907853269984665640564039457584007913129639936')
 */
export type BigInteger = bigint & Brand.Brand<'BigInteger'>

/**
 * Type predicate to check if value is a BigInteger.
 *
 * @param value - The value to check
 * @returns True if value is a BigInteger
 *
 * @example
 * BigInteger.is(123n) // true
 * BigInteger.is(BigInteger.from(456)) // true
 * BigInteger.is(123) // false (regular number)
 * BigInteger.is('123') // false (string)
 */
export const is = (value: unknown): value is BigInteger => {
  return typeof value === 'bigint'
}

/**
 * Construct a BigInteger from various input types.
 *
 * Accepts numbers, strings, and existing bigints, providing a safe way
 * to create arbitrary precision integers from different sources.
 *
 * @param value - The value to convert (number, string, or bigint)
 * @returns The BigInteger representation
 *
 * @example
 * BigInteger.from(123) // 123n
 * BigInteger.from('123456789012345678901234567890') // huge number as bigint
 * BigInteger.from(123n) // 123n (already a bigint)
 * BigInteger.from(Number.MAX_SAFE_INTEGER + 1) // 9007199254740992n
 *
 * // Financial: exact penny calculations
 * const cents = BigInteger.from('123456789') // $1,234,567.89 in cents
 *
 * // Cryptography: large prime numbers
 * const prime = BigInteger.from('2^127 - 1') // Mersenne prime (as string)
 */
export const from = (value: number | string | bigint): BigInteger => {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    throw new Error('BigInteger can only represent integers, not decimals')
  }

  return BigInt(value) as BigInteger
}

/**
 * BigInteger constants for common values.
 */
export const ZERO = from(0)
export const ONE = from(1)
export const TWO = from(2)

/**
 * Add two BigIntegers together.
 *
 * Performs exact addition without precision loss, regardless of the size
 * of the numbers involved.
 *
 * @param a - First BigInteger to add
 * @param b - Second BigInteger to add
 * @returns The exact sum as a BigInteger
 *
 * @example
 * const large1 = BigInteger.from('123456789012345678901234567890')
 * const large2 = BigInteger.from('987654321098765432109876543210')
 * const sum = BigInteger.add(large1, large2) // exact result
 *
 * // Financial: adding account balances in cents
 * const balance1 = BigInteger.from('1234567890') // $12,345,678.90
 * const balance2 = BigInteger.from('9876543210') // $98,765,432.10
 * const total = BigInteger.add(balance1, balance2) // exact total
 */
export const add = (a: BigInteger, b: BigInteger): BigInteger => {
  return (a + b) as BigInteger
}

/**
 * Create a function that operates on a specific BigInteger by adding to it.
 * Data-first pattern: the fixed value is the first parameter.
 *
 * @param a - The BigInteger that will have values added to it
 * @returns A function that adds its input to the fixed BigInteger
 *
 * @example
 * const addToMillion = BigInteger.addOn(BigInteger.from(1000000))
 * addToMillion(BigInteger.from(123)) // 1000123n (1000000 + 123)
 * addToMillion(BigInteger.from(456)) // 1000456n (1000000 + 456)
 *
 * // Track running total
 * const runningTotal = BigInteger.from('10000') // $100.00 in cents
 * const addToTotal = BigInteger.addOn(runningTotal)
 * addToTotal(BigInteger.from('250')) // 10250n (add $2.50)
 */
export const addOn = Fn.curry(add)

/**
 * Create a function that adds with a specific BigInteger value.
 * Data-second pattern: the fixed value is the second parameter.
 *
 * @param b - The BigInteger to add to inputs
 * @returns A function that adds the fixed BigInteger to its input
 *
 * @example
 * const addTax = BigInteger.addWith(BigInteger.from(750)) // $7.50 tax
 * addTax(BigInteger.from(10000)) // 10750n ($100.00 + $7.50)
 * addTax(BigInteger.from(5000)) // 5750n ($50.00 + $7.50)
 *
 * // Processing arrays: add fixed amount to all
 * const prices = [BigInteger.from(1000), BigInteger.from(2500)]
 * const withTax = prices.map(BigInteger.addWith(BigInteger.from(150)))
 */
export const addWith = Fn.flipCurried(Fn.curry(add))

/**
 * Subtract two BigIntegers.
 *
 * @param a - First BigInteger (minuend)
 * @param b - Second BigInteger (subtrahend)
 * @returns The exact difference as a BigInteger
 *
 * @example
 * const large = BigInteger.from('999999999999999999999999999999')
 * const small = BigInteger.from('1')
 * const diff = BigInteger.subtract(large, small) // 999999999999999999999999999998n
 */
export const subtract = (a: BigInteger, b: BigInteger): BigInteger => {
  return (a - b) as BigInteger
}

/**
 * Create a function that subtracts with a specific BigInteger.
 * Data-second pattern: the fixed value is the second parameter (subtrahend).
 *
 * @param b - The BigInteger to subtract from inputs
 * @returns A function that subtracts the fixed BigInteger from its input
 *
 * @example
 * const subtractTen = BigInteger.subtractWith(BigInteger.from(10))
 * subtractTen(BigInteger.from(50)) // 40n (50 - 10)
 * subtractTen(BigInteger.from(100)) // 90n (100 - 10)
 */
export const subtractWith = Fn.flipCurried(Fn.curry(subtract))

/**
 * Create a function that operates on a specific BigInteger by subtracting from it.
 * Data-first pattern: the fixed value is the first parameter (minuend).
 *
 * @param a - The BigInteger that will have values subtracted from it
 * @returns A function that subtracts its input from the fixed BigInteger
 *
 * @example
 * const subtractFromBudget = BigInteger.subtractOn(BigInteger.from(100000)) // $1000 budget
 * subtractFromBudget(BigInteger.from(15000)) // 85000n (remaining after $150 expense)
 * subtractFromBudget(BigInteger.from(25000)) // 75000n (remaining after $250 expense)
 */
export const subtractOn = Fn.curry(subtract)

/**
 * Multiply two BigIntegers.
 *
 * @param a - First BigInteger
 * @param b - Second BigInteger
 * @returns The exact product as a BigInteger
 *
 * @example
 * const base = BigInteger.from('12345678901234567890')
 * const multiplier = BigInteger.from('98765432109876543210')
 * const product = BigInteger.multiply(base, multiplier) // huge exact result
 *
 * // Compound interest calculations
 * const principal = BigInteger.from('100000000') // $1M in cents
 * const rate = BigInteger.from('105') // 1.05 as 105/100
 * const afterOneYear = BigInteger.multiply(principal, rate) // then divide by 100
 */
export const multiply = (a: BigInteger, b: BigInteger): BigInteger => {
  return (a * b) as BigInteger
}

/**
 * Create a function that operates on a specific BigInteger by multiplying it.
 * Data-first pattern: the fixed value is the first parameter.
 *
 * @param a - The BigInteger that will be multiplied by other values
 * @returns A function that multiplies the fixed BigInteger by its input
 *
 * @example
 * const basePrice = BigInteger.from(1000) // $10.00
 * const applyQuantity = BigInteger.multiplyOn(basePrice)
 * applyQuantity(BigInteger.from(5)) // 5000n (5 items at $10 each)
 * applyQuantity(BigInteger.from(12)) // 12000n (12 items at $10 each)
 */
export const multiplyOn = Fn.curry(multiply)

/**
 * Create a function that multiplies with a specific BigInteger.
 * Data-second pattern: the fixed value is the second parameter (multiplier).
 *
 * @param b - The BigInteger to multiply by
 * @returns A function that multiplies its input by the fixed BigInteger
 *
 * @example
 * const double = BigInteger.multiplyWith(BigInteger.TWO)
 * double(BigInteger.from(123)) // 246n
 * double(BigInteger.from(50)) // 100n
 *
 * const toMicros = BigInteger.multiplyWith(BigInteger.from(1000000))
 * toMicros(BigInteger.from(5)) // 5000000n (5 seconds to microseconds)
 */
export const multiplyWith = Fn.flipCurried(Fn.curry(multiply))

/**
 * Divide two BigIntegers using integer division (truncates toward zero).
 *
 * @param a - First BigInteger (dividend)
 * @param b - Second BigInteger (divisor, must be non-zero)
 * @returns The quotient as a BigInteger (truncated)
 * @throws Error if divisor is zero
 *
 * @example
 * BigInteger.divide(BigInteger.from(10), BigInteger.from(3)) // 3n (truncated)
 * BigInteger.divide(BigInteger.from(-10), BigInteger.from(3)) // -3n (truncates toward zero)
 *
 * // Converting cents to dollars (truncated)
 * const cents = BigInteger.from('12345') // $123.45 in cents
 * const dollars = BigInteger.divide(cents, BigInteger.from(100)) // 123n dollars
 */
export const divide = (a: BigInteger, b: BigInteger): BigInteger => {
  if (b === ZERO) {
    throw new Error('Cannot divide by zero')
  }
  return (a / b) as BigInteger
}

/**
 * Create a function that operates on a specific BigInteger by dividing it.
 * Data-first pattern: the fixed value is the first parameter (dividend).
 *
 * @param a - The BigInteger that will be divided by other values
 * @returns A function that divides the fixed BigInteger by its input
 *
 * @example
 * const splitBudget = BigInteger.divideOn(BigInteger.from(120000)) // $1200 total
 * splitBudget(BigInteger.from(4)) // 30000n ($300 per person among 4)
 * splitBudget(BigInteger.from(6)) // 20000n ($200 per person among 6)
 */
export const divideOn = Fn.curry(divide)

/**
 * Create a function that divides by a specific BigInteger.
 * Data-second pattern: the fixed value is the second parameter (divisor).
 *
 * @param b - The BigInteger to divide by
 * @returns A function that divides its input by the fixed BigInteger
 *
 * @example
 * const halve = BigInteger.divideWith(BigInteger.TWO)
 * halve(BigInteger.from(100)) // 50n
 * halve(BigInteger.from(246)) // 123n
 *
 * const toDollars = BigInteger.divideWith(BigInteger.from(100))
 * toDollars(BigInteger.from(12345)) // 123n (cents to dollars, truncated)
 */
export const divideWith = Fn.flipCurried(Fn.curry(divide))

/**
 * Get the remainder of BigInteger division.
 *
 * @param a - First BigInteger (dividend)
 * @param b - Second BigInteger (divisor, must be non-zero)
 * @returns The remainder as a BigInteger
 * @throws Error if divisor is zero
 *
 * @example
 * BigInteger.remainder(BigInteger.from(10), BigInteger.from(3)) // 1n
 * BigInteger.remainder(BigInteger.from(123), BigInteger.from(10)) // 3n (last digit)
 *
 * // Check if number is even
 * const isEven = (n: BigInteger) => BigInteger.remainder(n, BigInteger.TWO) === BigInteger.ZERO
 */
export const remainder = (a: BigInteger, b: BigInteger): BigInteger => {
  if (b === ZERO) {
    throw new Error('Cannot get remainder with zero divisor')
  }
  return (a % b) as BigInteger
}

/**
 * Create a function that operates on a specific BigInteger to get its remainder.
 * Data-first pattern: the fixed value is the first parameter (dividend).
 *
 * @param a - The BigInteger that will be divided to get remainders
 * @returns A function that returns the remainder when the fixed BigInteger is divided by its input
 *
 * @example
 * const checkDivisibility = BigInteger.remainderOn(BigInteger.from(100))
 * checkDivisibility(BigInteger.from(3)) // 1n (100 % 3 = 1, not divisible)
 * checkDivisibility(BigInteger.from(4)) // 0n (100 % 4 = 0, divisible)
 * checkDivisibility(BigInteger.from(5)) // 0n (100 % 5 = 0, divisible)
 */
export const remainderOn = Fn.curry(remainder)

/**
 * Create a function that gets remainder with a specific divisor.
 * Data-second pattern: the fixed value is the second parameter (divisor).
 *
 * @param b - The BigInteger divisor
 * @returns A function that gets remainder when its input is divided by the fixed BigInteger
 *
 * @example
 * const mod10 = BigInteger.remainderWith(BigInteger.from(10))
 * mod10(BigInteger.from(123)) // 3n (last digit)
 * mod10(BigInteger.from(456)) // 6n (last digit)
 *
 * const isEven = (n: BigInteger) => BigInteger.remainderWith(BigInteger.TWO)(n) === BigInteger.ZERO
 */
export const remainderWith = Fn.flipCurried(Fn.curry(remainder))

/**
 * Raise a BigInteger to a power.
 *
 * @param base - The BigInteger base
 * @param exponent - The BigInteger exponent (must be non-negative)
 * @returns base raised to the power of exponent
 * @throws Error if exponent is negative
 *
 * @example
 * BigInteger.power(BigInteger.TWO, BigInteger.from(10)) // 1024n (2^10)
 * BigInteger.power(BigInteger.from(10), BigInteger.from(18)) // 1000000000000000000n
 *
 * // Factorial approximation using powers
 * const factorial5 = BigInteger.power(BigInteger.from(5), BigInteger.from(5)) // rough approximation
 */
export const power = (base: BigInteger, exponent: BigInteger): BigInteger => {
  if (exponent < ZERO) {
    throw new Error('BigInteger power does not support negative exponents')
  }
  return (base ** exponent) as BigInteger
}

/**
 * Create a function that operates on a specific BigInteger base by raising it to powers.
 * Data-first pattern: the fixed value is the first parameter (base).
 *
 * @param base - The base BigInteger that will be raised to various powers
 * @returns A function that raises the fixed base to the power of its input
 *
 * @example
 * const powersOfTwo = BigInteger.powerOn(BigInteger.TWO)
 * powersOfTwo(BigInteger.from(8)) // 256n (2^8)
 * powersOfTwo(BigInteger.from(10)) // 1024n (2^10)
 * powersOfTwo(BigInteger.from(16)) // 65536n (2^16)
 */
export const powerOn = Fn.curry(power)

/**
 * Create a function that raises to a specific power.
 * Data-second pattern: the fixed value is the second parameter (exponent).
 *
 * @param exponent - The exponent to use
 * @returns A function that raises its input to the fixed exponent
 *
 * @example
 * const square = BigInteger.powerWith(BigInteger.TWO)
 * square(BigInteger.from(12)) // 144n
 * square(BigInteger.from(5)) // 25n
 *
 * const cube = BigInteger.powerWith(BigInteger.from(3))
 * cube(BigInteger.from(5)) // 125n
 * cube(BigInteger.from(10)) // 1000n
 */
export const powerWith = Fn.flipCurried(Fn.curry(power))

/**
 * Get the absolute value of a BigInteger.
 *
 * @param value - The BigInteger
 * @returns The absolute value as a BigInteger
 *
 * @example
 * BigInteger.abs(BigInteger.from(-123)) // 123n
 * BigInteger.abs(BigInteger.from(456)) // 456n
 * BigInteger.abs(BigInteger.ZERO) // 0n
 */
export const abs = (value: BigInteger): BigInteger => {
  return value < ZERO ? subtract(ZERO, value) : value
}

/**
 * Compare two BigIntegers.
 *
 * @param a - First BigInteger
 * @param b - Second BigInteger
 * @returns -1 if a < b, 0 if a = b, 1 if a > b
 *
 * @example
 * const large = BigInteger.from('999999999999999999999999999999')
 * const small = BigInteger.from('1')
 * BigInteger.compare(small, large) // -1
 * BigInteger.compare(large, small) // 1
 * BigInteger.compare(large, large) // 0
 */
export const compare = (a: BigInteger, b: BigInteger): -1 | 0 | 1 => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Create a function that operates on a specific BigInteger by comparing it.
 * Data-first pattern: the fixed value is the first parameter.
 *
 * @param a - The BigInteger that will be compared to other values
 * @returns A function that compares the fixed BigInteger with its input
 *
 * @example
 * const compareFromThreshold = BigInteger.compareOn(BigInteger.from(1000000))
 * compareFromThreshold(BigInteger.from(500000)) // 1 (1M > 500K)
 * compareFromThreshold(BigInteger.from(2000000)) // -1 (1M < 2M)
 * compareFromThreshold(BigInteger.from(1000000)) // 0 (1M = 1M)
 */
export const compareOn = Fn.curry(compare)

/**
 * Create a function that compares with a specific BigInteger.
 * Data-second pattern: the fixed value is the second parameter.
 *
 * @param b - The BigInteger to compare against
 * @returns A function that compares its input with the fixed BigInteger
 *
 * @example
 * const compareToMillion = BigInteger.compareWith(BigInteger.from(1000000))
 * compareToMillion(BigInteger.from(500000)) // -1 (500K < 1M)
 * compareToMillion(BigInteger.from(2000000)) // 1 (2M > 1M)
 * compareToMillion(BigInteger.from(1000000)) // 0 (1M = 1M)
 *
 * // Filtering: find all values greater than threshold
 * const aboveThreshold = values.filter(v => BigInteger.compareWith(threshold)(v) > 0)
 */
export const compareWith = Fn.flipCurried(Fn.curry(compare))

/**
 * Check if a BigInteger is even.
 *
 * @param value - The BigInteger to check
 * @returns True if the BigInteger is even
 *
 * @example
 * BigInteger.isEven(BigInteger.from(2)) // true
 * BigInteger.isEven(BigInteger.from(3)) // false
 * BigInteger.isEven(BigInteger.ZERO) // true
 */
export const isEven = (value: BigInteger): boolean => {
  return remainder(value, TWO) === ZERO
}

/**
 * Check if a BigInteger is odd.
 *
 * @param value - The BigInteger to check
 * @returns True if the BigInteger is odd
 *
 * @example
 * BigInteger.isOdd(BigInteger.from(2)) // false
 * BigInteger.isOdd(BigInteger.from(3)) // true
 * BigInteger.isOdd(BigInteger.ZERO) // false
 */
export const isOdd = (value: BigInteger): boolean => {
  return remainder(value, TWO) === ONE
}

/**
 * Check if a BigInteger is positive (> 0).
 *
 * @param value - The BigInteger to check
 * @returns True if the BigInteger is positive
 *
 * @example
 * BigInteger.isPositive(BigInteger.ONE) // true
 * BigInteger.isPositive(BigInteger.ZERO) // false
 * BigInteger.isPositive(BigInteger.from(-1)) // false
 */
export const isPositive = (value: BigInteger): boolean => {
  return value > ZERO
}

/**
 * Check if a BigInteger is negative (< 0).
 *
 * @param value - The BigInteger to check
 * @returns True if the BigInteger is negative
 *
 * @example
 * BigInteger.isNegative(BigInteger.from(-1)) // true
 * BigInteger.isNegative(BigInteger.ZERO) // false
 * BigInteger.isNegative(BigInteger.ONE) // false
 */
export const isNegative = (value: BigInteger): boolean => {
  return value < ZERO
}

/**
 * Check if a BigInteger is zero.
 *
 * @param value - The BigInteger to check
 * @returns True if the BigInteger is zero
 *
 * @example
 * BigInteger.isZero(BigInteger.ZERO) // true
 * BigInteger.isZero(BigInteger.ONE) // false
 */
export const isZero = (value: BigInteger): boolean => {
  return value === ZERO
}

/**
 * Convert BigInteger to regular number.
 *
 * WARNING: May lose precision if the BigInteger is larger than Number.MAX_SAFE_INTEGER.
 *
 * @param value - The BigInteger to convert
 * @returns The number representation
 * @throws Error if the BigInteger is too large for safe conversion
 *
 * @example
 * BigInteger.toNumber(BigInteger.from(123)) // 123
 * BigInteger.toNumber(BigInteger.from(Number.MAX_SAFE_INTEGER)) // 9007199254740991
 * // BigInteger.toNumber(BigInteger.from('99999999999999999999')) // throws Error
 */
export const toNumber = (value: BigInteger): number => {
  const num = Number(value)
  if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
    throw new Error('BigInteger too large for safe number conversion')
  }
  return num
}

/**
 * Convert BigInteger to string representation.
 *
 * @param value - The BigInteger to convert
 * @param radix - The base to use (default: 10)
 * @returns String representation
 *
 * @example
 * BigInteger.toString(BigInteger.from(123)) // "123"
 * BigInteger.toString(BigInteger.from(255), 16) // "ff" (hexadecimal)
 * BigInteger.toString(BigInteger.from(8), 2) // "1000" (binary)
 *
 * // Display large numbers with separators
 * const large = BigInteger.from('123456789012345678901234567890')
 * const str = BigInteger.toString(large) // "123456789012345678901234567890"
 */
export const toString = (value: BigInteger, radix: number = 10): string => {
  return value.toString(radix)
}
