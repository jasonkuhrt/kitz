/**
 * Core numeric operations that work with branded types.
 */

import type { Negative } from './negative/__.js'
import type { NonNegative } from './non-negative/__.js'
import type { NonPositive } from './non-positive/__.js'
import type { NonZero } from './non-zero/__.js'
import type { Positive } from './positive/__.js'
import type { Zero } from './zero/__.js'

/**
 * Type predicate to check if value is a number.
 * Excludes NaN by default.
 */
export const is = (value: unknown): value is number => {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Type predicate to check if value is NaN.
 */
export const isNaN = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isNaN(value)
}

/**
 * Type-level absolute value transformation.
 * Maps number types to their absolute value types.
 */
export type Abs<T extends number> = T extends Positive
  ? Positive
  : T extends Negative
    ? Positive
    : T extends NonPositive
      ? NonNegative
      : T extends Zero
        ? Zero
        : NonNegative

/**
 * Get absolute value.
 * Returns the non-negative magnitude of a number.
 *
 * @param value - The number to get absolute value of
 * @returns The absolute value with appropriate branded type
 *
 * @example
 * abs(5) // 5 (type: Positive)
 * abs(-5) // 5 (type: Positive)
 * abs(0) // 0 (type: Zero)
 * abs(-0) // 0 (type: Zero)
 */
export const abs = <T extends number>(value: T): Abs<T> => {
  return Math.abs(value) as Abs<T>
}

/**
 * Type-level sign transformation.
 * Maps number types to their sign (-1, 0, 1).
 */
export type Sign<T extends number> = T extends Positive
  ? 1
  : T extends Negative
    ? -1
    : T extends Zero
      ? 0
      : -1 | 0 | 1

/**
 * Get sign of number (-1, 0, 1).
 * Returns -1 for negative numbers, 0 for zero, and 1 for positive numbers.
 *
 * @param value - The number to get the sign of
 * @returns -1, 0, or 1 with precise type
 *
 * @example
 * sign(5) // 1
 * sign(-5) // -1
 * sign(0) // 0
 * sign(-0) // 0
 * sign(0.1) // 1
 * sign(-0.1) // -1
 */
export const sign = <T extends number>(value: T): Sign<T> => {
  return Math.sign(value) as Sign<T>
}

/**
 * Increment by 1.
 */
export const inc = (value: number): number => {
  return value + 1
}

/**
 * Decrement by 1.
 */
export const dec = (value: number): number => {
  return value - 1
}

/**
 * Type-level modulo transformation.
 * Modulo always returns a non-negative result.
 */
export type Mod<_T extends number, _U extends NonZero> = NonNegative

/**
 * Modulo operation that always returns positive result.
 * Unlike the % operator, this always returns a non-negative result.
 * The divisor must be non-zero for a valid result.
 *
 * @param dividend - The number to divide
 * @param divisor - The non-zero number to divide by
 * @returns The positive remainder
 *
 * @example
 * import { nonZero } from './non-zero/__.js'
 *
 * mod(7, nonZero(3)) // 1
 * mod(-7, nonZero(3)) // 2 (not -1)
 * mod(7, nonZero(-3)) // 1
 * mod(-7, nonZero(-3)) // 2
 *
 * // Common use: Wrapping values in a range
 * const hourOfDay = mod(hour, nonZero(24)) // Always 0-23
 * const dayOfWeek = mod(dayNumber, nonZero(7)) // Always 0-6
 */
export const mod = <T extends number, U extends NonZero>(dividend: T, divisor: U): Mod<T, U> => {
  const result = ((dividend % divisor) + Math.abs(divisor)) % Math.abs(divisor)
  return result as Mod<T, U>
}

/**
 * Create a function that calculates modulo with a fixed dividend.
 *
 * @param dividend - The fixed dividend
 * @returns A function that takes a divisor and returns the modulo
 *
 * @example
 * import { nonZero } from './non-zero/__.js'
 *
 * const mod7 = modOn(7)
 * mod7(nonZero(3)) // 1
 * mod7(nonZero(5)) // 2
 */
export const modOn =
  <T extends number>(dividend: T) =>
  <U extends NonZero>(divisor: U): Mod<T, U> => {
    return mod(dividend, divisor)
  }

/**
 * Create a function that calculates modulo with a fixed divisor.
 * Useful for wrapping values in a fixed range.
 *
 * @param divisor - The fixed non-zero divisor
 * @returns A function that takes a dividend and returns the modulo
 *
 * @example
 * import { nonZero } from './non-zero/__.js'
 *
 * const mod24 = modWith(nonZero(24)) // For 24-hour time
 * mod24(25) // 1 (25 hours = 1 AM next day)
 * mod24(-1) // 23 (1 hour before midnight)
 *
 * const wrapAngle = modWith(nonZero(360)) // For degrees
 * wrapAngle(380) // 20 (380° = 20°)
 */
export const modWith =
  <U extends NonZero>(divisor: U) =>
  <T extends number>(dividend: T): Mod<T, U> => {
    return mod(dividend, divisor)
  }

/**
 * Number literal type.
 */
export type Literal =
  | LiteralZero
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | LiteralInfinity

export type LiteralInfinity = -999999999999999

export type LiteralZero = 0

/**
 * Add one to a number literal type.
 */
export type PlusOne<$n extends Literal> = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  never,
][$n]

/**
 * Subtract one from a number literal type.
 */
export type MinusOne<$n extends Literal> = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
][$n]

// oxfmt-ignore
export type NatDec<$N extends Literal> =
  $N extends LiteralInfinity          ? LiteralInfinity :
  $N extends LiteralZero              ? LiteralZero :
                                        MinusOne<$N>
