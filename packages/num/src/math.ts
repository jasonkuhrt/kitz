import { Fn } from '@kitz/core'
import type { Degrees } from './degrees/__.js'
import type { Finite } from './finite/__.js'
import type { InRange } from './in-range/__.js'
import type { Int } from './int/__.js'
import type { Natural } from './natural/__.js'
import type { NonNegative } from './non-negative/__.js'
import type { NonZero } from './non-zero/__.js'
import type { Positive } from './positive/__.js'
import type { Radians } from './radians/__.js'
import type { Whole } from './whole/__.js'

/**
 * Add two numbers together.
 *
 * @category Arithmetic
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition}
 * @param a - The first number to add
 * @param b - The second number to add
 * @returns The sum of a and b
 *
 * @example
 * add(5, 3) // 8
 * add(2.5, 1.5) // 4
 * add(-10, 5) // -5
 */
export const add = (a: number, b: number): number => {
  return a + b
}

/**
 * Create a function that adds a specific number to any other number.
 * This is useful when you want to add the same number multiple times.
 *
 * @category Arithmetic
 * @see {@link add}
 * @param a - The number that will always be added
 * @returns A function that adds 'a' to its input
 *
 * @example
 * const add5 = addWith(5)
 * add5(10) // 15
 * add5(20) // 25
 *
 * // Useful in array operations:
 * [1, 2, 3].map(addWith(10)) // [11, 12, 13]
 */
export const addWith = Fn.curry(add)

/**
 * Subtract one number from another.
 * Takes the second number away from the first number.
 *
 * @category Arithmetic
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Subtraction}
 * @param a - The number to subtract from (minuend)
 * @param b - The number to subtract (subtrahend)
 * @returns The difference between a and b
 *
 * @example
 * subtract(10, 3) // 7
 * subtract(5, 8) // -3
 * subtract(7.5, 2.5) // 5
 */
export const subtract = (a: number, b: number): number => {
  return a - b
}

/**
 * Create a function that subtracts other numbers from a specific number.
 * This is useful when you have a starting value and want to subtract various amounts from it.
 *
 * @category Arithmetic
 * @see {@link subtract}
 * @param a - The number to subtract from
 * @returns A function that subtracts its input from 'a'
 *
 * @example
 * const subtractWith10 = subtractWith(10)
 * subtractWith10(3) // 7
 * subtractWith10(15) // -5
 *
 * // Useful for calculating remaining amounts:
 * const budget = 100
 * const subtractWithBudget = subtractWith(budget)
 * subtractWithBudget(25) // 75 remaining
 */
export const subtractWith = Fn.curry(subtract)

/**
 * Multiply two numbers together.
 * This gives you the result of adding a number to itself b times.
 *
 * @category Arithmetic
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Multiplication}
 * @param a - The first number (multiplicand)
 * @param b - The second number (multiplier)
 * @returns The product of a and b
 *
 * @example
 * multiply(3, 4) // 12 (same as 3 + 3 + 3 + 3)
 * multiply(2.5, 2) // 5
 * multiply(-5, 3) // -15
 * multiply(7, 0) // 0
 */
export const multiply = (a: number, b: number): number => {
  return a * b
}

/**
 * Create a function that multiplies any number by a specific factor.
 * This is useful for scaling values or converting units.
 *
 * @category Arithmetic
 * @see {@link multiply}
 * @param factor - The number to multiply by
 * @returns A function that multiplies its input by the factor
 *
 * @example
 * const double = multiplyWith(2)
 * double(5) // 10
 * double(7) // 14
 *
 * // Useful for conversions:
 * const inchesToCm = multiplyWith(2.54)
 * inchesToCm(10) // 25.4 cm
 *
 * // Scaling values:
 * const scale = multiplyWith(1.5)
 * [10, 20, 30].map(scale) // [15, 30, 45]
 */
export const multiplyWith = Fn.flipCurried(Fn.curry(multiply))

/**
 * Divide one number by another.
 * This splits the first number into equal parts based on the second number.
 * The divisor must be non-zero.
 *
 * @category Arithmetic
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Division}
 * @param dividend - The number to be divided (what you're splitting up)
 * @param divisor - The non-zero number to divide by (how many parts to split into)
 * @returns The quotient (result of division)
 *
 * @example
 * divide(10, nonZero(2)) // 5 (10 split into 2 equal parts)
 * divide(15, nonZero(3)) // 5
 * divide(7, nonZero(2)) // 3.5
 * divide(1, nonZero(3)) // 0.3333...
 */
export const divide = (dividend: number, divisor: NonZero): number => {
  return dividend / divisor
}

/**
 * Create a function that divides any number by a specific divisor.
 * This is useful for splitting values into fixed portions.
 *
 * @category Arithmetic
 * @see {@link divide}
 * @param divisor - The non-zero number to divide by
 * @returns A function that divides its input by the divisor
 *
 * @example
 * const half = divideWith(nonZero(2))
 * half(10) // 5
 * half(7) // 3.5
 *
 * // Useful for conversions:
 * const cmToInches = divideWith(nonZero(2.54))
 * cmToInches(10) // 3.937... inches
 *
 * // Calculate averages:
 * const average = divideWith(nonZero(3))
 * average(15) // 5 (average when split 3 ways)
 */
export const divideWith =
  (divisor: NonZero) =>
  (dividend: number): number => {
    return divide(dividend, divisor)
  }

/**
 * Raise a number to a power (exponentiation).
 * This multiplies the base number by itself 'exponent' times.
 * For best results, use finite numbers to avoid NaN/Infinity.
 *
 * @category Exponentiation
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/pow}
 * @param base - The number to be multiplied by itself
 * @param exponent - How many times to multiply the base by itself
 * @returns The result of base raised to the exponent power
 *
 * @example
 * power(2, 3) // 8 (2 × 2 × 2)
 * power(5, 2) // 25 (5 × 5, also called "5 squared")
 * power(10, 3) // 1000 (10 × 10 × 10, also called "10 cubed")
 * power(2, 0) // 1 (any number to the power of 0 is 1)
 * power(2, -2) // 0.25 (negative powers give fractions: 1 / (2 × 2))
 * power(9, 0.5) // 3 (fractional powers give roots: square root of 9)
 *
 * // For type-safe operations with finite numbers:
 * import { finite } from './finite/__.js'
 * power(finite(2), finite(3)) // Guarantees finite inputs
 */
export const power = (base: number, exponent: number): number => {
  return Math.pow(base, exponent)
}

/**
 * Create a function that raises any number to a specific power.
 * This is useful for repeated exponentiations.
 *
 * @category Exponentiation
 * @see {@link power}
 * @param exponent - The power to raise numbers to
 * @returns A function that raises its input to the specified power
 *
 * @example
 * const square = powerWith(2)
 * square(5) // 25
 * square(10) // 100
 *
 * const cube = powerWith(3)
 * cube(2) // 8
 * cube(3) // 27
 *
 * // Calculate areas or volumes:
 * const circleArea = (radius: number) => PI * square(radius)
 * circleArea(5) // ~78.54
 */
export const powerWith = Fn.flipCurried(Fn.curry(power))

/**
 * Round a number to the nearest integer or to a specific number of decimal places.
 * Rounding follows standard rules: 0.5 and above rounds up, below 0.5 rounds down.
 *
 * @category Rounding
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round}
 * @param value - The number to round
 * @param precision - Number of decimal places to keep (default: 0 for whole numbers)
 * @returns The rounded number
 *
 * @example
 * // Rounding to whole numbers:
 * round(4.7) // 5
 * round(4.3) // 4
 * round(4.5) // 5
 * round(-2.5) // -2
 *
 * // Rounding to decimal places:
 * round(3.14159, 2) // 3.14
 * round(1.235, 2) // 1.24
 * round(5.6789, 3) // 5.679
 *
 * // Rounding to tens, hundreds, etc. with negative precision:
 * round(1234, -1) // 1230
 * round(1234, -2) // 1200
 */
export const round = (value: number, precision: number = 0): number => {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

/**
 * Create a function that rounds numbers to a specific number of decimal places.
 * This is useful when you need consistent precision across multiple values.
 *
 * @category Rounding
 * @see {@link round}
 * @param precision - Number of decimal places to keep
 * @returns A function that rounds its input to the specified precision
 *
 * @example
 * const roundTo2 = roundWith(2)
 * roundTo2(3.14159) // 3.14
 * roundTo2(2.345) // 2.35
 * roundTo2(1.005) // 1.01
 *
 * // Useful for currency:
 * const roundCents = roundWith(2)
 * [10.333, 20.667, 5.555].map(roundCents) // [10.33, 20.67, 5.56]
 *
 * // Or for percentages:
 * const roundPercent = roundWith(1)
 * roundPercent(33.33333) // 33.3
 */
export const roundWith = Fn.flipCurried(Fn.curry(round))

/**
 * Type-level floor transformation.
 * Floor always returns an integer.
 */
export type Floor<_T extends number> = Int

/**
 * Round a number down to the nearest integer.
 * This always rounds towards negative infinity, removing any decimal part.
 * The input must be finite to ensure a valid integer result.
 *
 * @category Rounding
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor}
 * @param value - The finite number to round down
 * @returns The largest integer less than or equal to the value
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * floor(finite(4.9)) // 4
 * floor(finite(4.1)) // 4
 * floor(finite(4)) // 4
 *
 * // Note: For negative numbers, it rounds "more negative":
 * floor(finite(-4.1)) // -5
 * floor(finite(-4.9)) // -5
 *
 * // Common use: Getting whole units from a decimal
 * const dollars = floor(finite(10.99)) // 10
 * const hours = floor(finite(2.75)) // 2
 */
export const floor = <T extends Finite>(value: T): Floor<T> => {
  return Math.floor(value) as Floor<T>
}

/**
 * Type-level ceil transformation.
 * Ceil always returns an integer.
 */
export type Ceil<_T extends number> = Int

/**
 * Round a number up to the nearest integer.
 * This always rounds towards positive infinity.
 * The input must be finite to ensure a valid integer result.
 *
 * @category Rounding
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil}
 * @param value - The finite number to round up
 * @returns The smallest integer greater than or equal to the value
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * ceil(finite(4.1)) // 5
 * ceil(finite(4.9)) // 5
 * ceil(finite(4)) // 4
 *
 * // Note: For negative numbers, it rounds "less negative":
 * ceil(finite(-4.9)) // -4
 * ceil(finite(-4.1)) // -4
 *
 * // Common use: Calculating how many containers you need
 * const items = 10
 * const itemsPerBox = 3
 * const boxesNeeded = ceil(finite(items / itemsPerBox)) // 4 boxes
 */
export const ceil = <T extends Finite>(value: T): Ceil<T> => {
  return Math.ceil(value) as Ceil<T>
}

/**
 * Type-level trunc transformation.
 * Trunc always returns an integer.
 */
export type Trunc<_T extends number> = Int

/**
 * Remove the decimal part of a number (truncate).
 * This simply cuts off the decimal portion, always rounding towards zero.
 * The input must be finite to ensure a valid integer result.
 *
 * @category Rounding
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc}
 * @param value - The finite number to truncate
 * @returns The integer part of the number
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * trunc(finite(4.9)) // 4
 * trunc(finite(4.1)) // 4
 * trunc(finite(-4.9)) // -4 (different from floor which would give -5)
 * trunc(finite(-4.1)) // -4
 *
 * // Difference from floor for negative numbers:
 * floor(finite(-3.7)) // -4 (rounds down)
 * trunc(finite(-3.7)) // -3 (removes decimal)
 *
 * // Common use: Getting the whole number part
 * const wholePart = trunc(finite(123.456)) // 123
 */
export const trunc = <T extends Finite>(value: T): Trunc<T> => {
  return Math.trunc(value) as Trunc<T>
}

/**
 * Type-level sqrt transformation.
 * Square root of non-negative returns non-negative.
 * Square root of positive returns positive (except for 0).
 */
export type Sqrt<T extends number> = T extends Positive
  ? Positive
  : T extends NonNegative
    ? NonNegative
    : number

/**
 * Calculate the square root of a non-negative number.
 * The square root is a number that, when multiplied by itself, gives the original number.
 * For type safety, this requires a non-negative input to avoid NaN results.
 *
 * @category Roots
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sqrt}
 * @param value - The non-negative number to find the square root of
 * @returns The square root of the value
 *
 * @example
 * import { from as nonNegative } from './non-negative/__.js'
 * import { from as positive } from './positive/__.js'
 *
 * sqrt(nonNegative(9)) // 3 (because 3 × 3 = 9)
 * sqrt(nonNegative(16)) // 4 (because 4 × 4 = 16)
 * sqrt(nonNegative(2)) // 1.414... (approximately)
 * sqrt(nonNegative(0)) // 0
 *
 * // Type-safe: positive input gives positive output
 * sqrt(positive(4)) // 2 as Positive
 *
 * // Common use: Finding distances or scaling
 * const area = nonNegative(100)
 * const sideLength = sqrt(area) // 10
 */
export const sqrt = <T extends NonNegative>(value: T): Sqrt<T> => {
  return Math.sqrt(value) as Sqrt<T>
}

/**
 * Calculate the cube root of a number.
 * The cube root is a number that, when multiplied by itself three times, gives the original number.
 *
 * @category Roots
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cbrt}
 * @param value - The number to find the cube root of
 * @returns The cube root of the value
 *
 * @example
 * cbrt(8) // 2 (because 2 × 2 × 2 = 8)
 * cbrt(27) // 3 (because 3 × 3 × 3 = 27)
 * cbrt(-8) // -2 (cube root can handle negative numbers)
 * cbrt(1) // 1
 *
 * // Common use: Finding dimensions from volume
 * const sideLength = cbrt(volume) // Find side of a cube from its volume
 */
export const cbrt = (value: number): number => {
  return Math.cbrt(value)
}

/**
 * Calculate the natural logarithm (base e) of a number.
 * The logarithm tells you what power you need to raise e (≈2.718) to get your number.
 * It's the inverse operation of exponential (e^x).
 *
 * @category Logarithms
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log}
 * @param value - The positive number to find the natural logarithm of
 * @returns The natural logarithm of the value
 *
 * @example
 * import { from as positive } from './positive/__.js'
 *
 * log(positive(E)) // 1 (because e^1 = e)
 * log(positive(1)) // 0 (because e^0 = 1)
 * log(positive(E * E)) // 2 (because e^2 = e × e)
 *
 * // Common use: Growth rates, compound interest, scientific calculations
 * const growthRate = log(positive(finalValue / initialValue)) / time
 */
export const log = (value: Positive): number => {
  return Math.log(value)
}

/**
 * Calculate the base-10 logarithm of a number.
 * This tells you what power you need to raise 10 to get your number.
 * It's commonly used for measuring orders of magnitude.
 *
 * @category Logarithms
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log10}
 * @param value - The positive number to find the base-10 logarithm of
 * @returns The base-10 logarithm of the value
 *
 * @example
 * import { from as positive } from './positive/__.js'
 *
 * log10(positive(10)) // 1 (because 10^1 = 10)
 * log10(positive(100)) // 2 (because 10^2 = 100)
 * log10(positive(1000)) // 3 (because 10^3 = 1000)
 * log10(positive(1)) // 0 (because 10^0 = 1)
 * log10(positive(0.1)) // -1 (because 10^-1 = 0.1)
 *
 * // Common use: Scientific notation, decibels, pH scale
 * const magnitude = floor(log10(positive(Math.abs(value)))) // Order of magnitude
 * const digits = floor(log10(positive(value))) + 1 // Number of digits in integer
 */
export const log10 = (value: Positive): number => {
  return Math.log10(value)
}

/**
 * Calculate the base-2 logarithm of a number.
 * This tells you what power you need to raise 2 to get your number.
 * It's commonly used in computer science for binary operations.
 *
 * @category Logarithms
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log2}
 * @param value - The positive number to find the base-2 logarithm of
 * @returns The base-2 logarithm of the value
 *
 * @example
 * import { from as positive } from './positive/__.js'
 *
 * log2(positive(2)) // 1 (because 2^1 = 2)
 * log2(positive(4)) // 2 (because 2^2 = 4)
 * log2(positive(8)) // 3 (because 2^3 = 8)
 * log2(positive(16)) // 4 (because 2^4 = 16)
 * log2(positive(1)) // 0 (because 2^0 = 1)
 * log2(positive(0.5)) // -1 (because 2^-1 = 0.5)
 *
 * // Common use: Binary trees, memory allocation, information theory
 * const bitsNeeded = ceil(log2(positive(numberOfItems))) // Bits to represent n items
 * const treeDepth = floor(log2(positive(nodeCount))) // Depth of balanced binary tree
 */
export const log2 = (value: Positive): number => {
  return Math.log2(value)
}

/**
 * Type-level sine transformation.
 * Sine always returns a value in the range [-1, 1].
 */
export type Sin<_T extends number> = InRange<-1, 1>

/**
 * Calculate the sine of an angle.
 * Sine is a trigonometric function that represents the ratio of the opposite side
 * to the hypotenuse in a right triangle. The angle must be in radians and finite.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sin}
 * @param radians - The angle in radians (must be finite)
 * @returns The sine of the angle, always between -1 and 1
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * sin(finite(0)) // 0
 * sin(finite(PI / 2)) // 1 (sine of 90 degrees)
 * sin(finite(PI)) // 0 (sine of 180 degrees)
 * sin(finite(3 * PI / 2)) // -1 (sine of 270 degrees)
 *
 * // Common use: Wave calculations, circular motion, oscillations
 * const waveHeight = amplitude * sin(finite(frequency * time))
 * const yPosition = radius * sin(finite(angle))
 *
 * // Note: Input is in radians, not degrees!
 * // To use degrees: sin(finite(degToRad(degrees)))
 */
export const sin = <T extends Finite>(radians: T): Sin<T> => {
  return Math.sin(radians) as Sin<T>
}

/**
 * Type-level cosine transformation.
 * Cosine always returns a value in the range [-1, 1].
 */
export type Cos<_T extends number> = InRange<-1, 1>

/**
 * Calculate the cosine of an angle.
 * Cosine is a trigonometric function that represents the ratio of the adjacent side
 * to the hypotenuse in a right triangle. The angle must be in radians and finite.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cos}
 * @param radians - The angle in radians (must be finite)
 * @returns The cosine of the angle, always between -1 and 1
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * cos(finite(0)) // 1
 * cos(finite(PI / 2)) // 0 (cosine of 90 degrees)
 * cos(finite(PI)) // -1 (cosine of 180 degrees)
 * cos(finite(2 * PI)) // 1 (cosine of 360 degrees, full circle)
 *
 * // Common use: Wave calculations, circular motion, projections
 * const xPosition = radius * cos(finite(angle))
 * const projection = vectorLength * cos(finite(angleBetween))
 *
 * // Note: Input is in radians, not degrees!
 * // To use degrees: cos(finite(degToRad(degrees)))
 */
export const cos = <T extends Finite>(radians: T): Cos<T> => {
  return Math.cos(radians) as Cos<T>
}

/**
 * Calculate the tangent of an angle.
 * Tangent is the ratio of sine to cosine, or the ratio of the opposite side
 * to the adjacent side in a right triangle. The angle must be in radians and finite.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tan}
 * @param radians - The angle in radians (must be finite)
 * @returns The tangent of the angle
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * tan(finite(0)) // 0
 * tan(finite(PI / 4)) // 1 (tangent of 45 degrees)
 * tan(finite(PI)) // 0 (tangent of 180 degrees)
 *
 * // Note: tan is undefined at PI/2 (90°) and 3*PI/2 (270°)
 * tan(finite(PI / 2)) // Very large number (approaching infinity)
 *
 * // Common use: Slopes, angles of elevation, trigonometry
 * const slope = tan(finite(angle)) // Rise over run
 * const heightAtDistance = distance * tan(finite(elevationAngle))
 */
export const tan = (radians: Finite): number => {
  return Math.tan(radians)
}

/**
 * Calculate the arcsine (inverse sine) of a value.
 * This gives you the angle whose sine is the input value.
 * The input must be in the range [-1, 1] to get a valid result.
 * The result is in radians.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asin}
 * @param value - A number between -1 and 1 (inclusive)
 * @returns The angle in radians, between -PI/2 and PI/2
 *
 * @example
 * import { inRange } from './in-range/__.js'
 *
 * asin(inRange(0, -1, 1)) // 0 (angle whose sine is 0)
 * asin(inRange(1, -1, 1)) // PI/2 (angle whose sine is 1, which is 90 degrees)
 * asin(inRange(-1, -1, 1)) // -PI/2 (angle whose sine is -1, which is -90 degrees)
 * asin(inRange(0.5, -1, 1)) // PI/6 (angle whose sine is 0.5, which is 30 degrees)
 *
 * // Type-safe: won't compile with out-of-range values
 * // asin(2) // Type error! Must be in range [-1, 1]
 *
 * // Common use: Finding angles from coordinates or ratios
 * const ratio = opposite / hypotenuse
 * const angle = asin(inRange(ratio, -1, 1))
 */
export const asin = (value: InRange<-1, 1>): Radians => {
  return Math.asin(value) as Radians
}

/**
 * Calculate the arccosine (inverse cosine) of a value.
 * This gives you the angle whose cosine is the input value.
 * The input must be in the range [-1, 1] to get a valid result.
 * The result is in radians.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos}
 * @param value - A number between -1 and 1 (inclusive)
 * @returns The angle in radians, between 0 and PI
 *
 * @example
 * import { inRange } from './in-range/__.js'
 *
 * acos(inRange(1, -1, 1)) // 0 (angle whose cosine is 1, which is 0 degrees)
 * acos(inRange(0, -1, 1)) // PI/2 (angle whose cosine is 0, which is 90 degrees)
 * acos(inRange(-1, -1, 1)) // PI (angle whose cosine is -1, which is 180 degrees)
 * acos(inRange(0.5, -1, 1)) // PI/3 (angle whose cosine is 0.5, which is 60 degrees)
 *
 * // Type-safe: won't compile with out-of-range values
 * // acos(2) // Type error! Must be in range [-1, 1]
 *
 * // Common use: Finding angles between vectors, dot product applications
 * const dotProduct = v1.x * v2.x + v1.y * v2.y
 * const magnitude = length1 * length2
 * const angleBetween = acos(inRange(dotProduct / magnitude, -1, 1))
 */
export const acos = (value: InRange<-1, 1>): Radians => {
  return Math.acos(value) as Radians
}

/**
 * Calculate the arctangent (inverse tangent) of a value.
 * This gives you the angle whose tangent is the input value.
 * The input must be finite to get a meaningful angle.
 * The result is in radians.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan}
 * @param value - Any finite number (the tangent of the angle)
 * @returns The angle in radians, between -PI/2 and PI/2
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * atan(finite(0)) // 0 (angle whose tangent is 0)
 * atan(finite(1)) // PI/4 (angle whose tangent is 1, which is 45 degrees)
 * atan(finite(-1)) // -PI/4 (angle whose tangent is -1, which is -45 degrees)
 * atan(finite(1000)) // ~PI/2 (very steep, approaching 90 degrees)
 *
 * // Common use: Finding angles from slopes or ratios
 * const angle = atan(finite(rise / run)) // Angle of a slope
 * const direction = atan(finite(dy / dx)) // Direction from velocity components
 *
 * // Note: atan2 is often more useful as it handles all quadrants
 */
export const atan = (value: Finite): Radians => {
  return Math.atan(value) as Radians
}

/**
 * Calculate the angle from the positive x-axis to a point (x, y).
 * This is like atan(y/x) but handles all quadrants correctly and avoids division by zero.
 * Both coordinates must be finite to get a meaningful angle.
 * The result is in radians.
 *
 * @category Trigonometry
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2}
 * @param y - The y-coordinate of the point (must be finite)
 * @param x - The x-coordinate of the point (must be finite)
 * @returns The angle in radians, between -PI and PI
 *
 * @example
 * import { finite } from './finite/__.js'
 *
 * atan2(finite(0), finite(1)) // 0 (point on positive x-axis)
 * atan2(finite(1), finite(0)) // PI/2 (point on positive y-axis)
 * atan2(finite(0), finite(-1)) // PI (point on negative x-axis)
 * atan2(finite(-1), finite(0)) // -PI/2 (point on negative y-axis)
 * atan2(finite(1), finite(1)) // PI/4 (45 degrees, first quadrant)
 *
 * // Common use: Finding direction from one point to another
 * const angle = atan2(finite(y2 - y1), finite(x2 - x1)) // Direction from (x1,y1) to (x2,y2)
 *
 * // Converting to degrees for display:
 * const degrees = radToDeg(atan2(finite(y), finite(x)))
 */
export const atan2 = (y: Finite, x: Finite): Radians => {
  return Math.atan2(y, x) as Radians
}

/**
 * Create a function that calculates atan2 with a fixed y value.
 * Useful for repeated calculations with the same y offset.
 *
 * @category Trigonometry
 * @see {@link atan2}
 * @param y - The fixed y-coordinate
 * @returns A function that takes x and returns atan2(y, x)
 */
export const atan2With = Fn.curry(atan2)

/**
 * Convert degrees to radians.
 * Most JavaScript math functions expect angles in radians, but humans often think in degrees.
 * This converts from the familiar degree system (0-360) to radians (0-2π).
 *
 * @category Angle Conversion
 * @see {@link radToDeg}
 * @param degrees - The angle in degrees
 * @returns The angle in radians
 *
 * @example
 * import { degrees } from './degrees/__.js'
 *
 * degToRad(degrees(0)) // 0
 * degToRad(degrees(90)) // PI/2 (about 1.571)
 * degToRad(degrees(180)) // PI (about 3.142)
 * degToRad(degrees(360)) // 2*PI (about 6.283)
 * degToRad(degrees(45)) // PI/4 (about 0.785)
 *
 * // Common use: Converting user input to math functions
 * const angle = degToRad(degrees(45)) // Convert 45° to radians
 * const height = sin(angle) * hypotenuse
 *
 * // Rotating objects:
 * const rotationInRadians = degToRad(degrees(rotationInDegrees))
 */
export const degToRad = (degrees: Degrees): Radians => {
  return (degrees * (Math.PI / 180)) as Radians
}

/**
 * Convert radians to degrees.
 * Math functions return angles in radians, but you might want to display them in degrees.
 * This converts from radians (0-2π) to the familiar degree system (0-360).
 *
 * @category Angle Conversion
 * @see {@link degToRad}
 * @param radians - The angle in radians
 * @returns The angle in degrees
 *
 * @example
 * import { radians } from './radians/__.js'
 *
 * radToDeg(radians(0)) // 0
 * radToDeg(radians(PI / 2)) // 90
 * radToDeg(radians(PI)) // 180
 * radToDeg(radians(2 * PI)) // 360
 * radToDeg(radians(PI / 4)) // 45
 *
 * // Common use: Displaying angles to users
 * const angleInDegrees = radToDeg(radians(atan2(y, x)))
 * console.log(`Direction: ${angleInDegrees}°`)
 *
 * // Converting math results for display:
 * const slopeAngle = radToDeg(radians(atan(rise / run)))
 */
export const radToDeg = (radians: Radians): Degrees => {
  return (radians * (180 / Math.PI)) as Degrees
}

/**
 * Type-level min transformation.
 * Returns the union of both input types (the more general type).
 */
export type Min<A extends number, B extends number> = A | B

/**
 * Find the smaller of two numbers.
 * Returns whichever number is less.
 *
 * @category Comparison
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min}
 * @param a - The first number to compare
 * @param b - The second number to compare
 * @returns The smaller of the two numbers
 *
 * @example
 * min(5, 3) // 3
 * min(10, 20) // 10
 * min(-5, -3) // -5 (more negative is smaller)
 * min(5, 5) // 5 (returns either when equal)
 *
 * // Common use: Limiting values, finding boundaries
 * const maxSpeed = min(userSpeed, speedLimit)
 * const availableItems = min(requested, inStock)
 *
 * // With arrays, use Math.min(...array) or array.reduce
 * const lowest = [1, 5, 3, 9, 2].reduce((a, b) => min(a, b))
 */
export const min = <A extends number, B extends number>(a: A, b: B): Min<A, B> => {
  return Math.min(a, b) as Min<A, B>
}

/**
 * Create a function that finds the minimum with a fixed first value.
 * Useful for clamping or limiting values.
 *
 * @category Comparison
 * @see {@link min}
 * @param a - The fixed first value to compare
 * @returns A function that takes b and returns min(a, b)
 */
export const minWith = Fn.curry(min)

/**
 * Type-level max transformation.
 * Returns the union of both input types (the more general type).
 */
export type Max<A extends number, B extends number> = A | B

/**
 * Find the larger of two numbers.
 * Returns whichever number is greater.
 *
 * @category Comparison
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max}
 * @param a - The first number to compare
 * @param b - The second number to compare
 * @returns The larger of the two numbers
 *
 * @example
 * max(5, 3) // 5
 * max(10, 20) // 20
 * max(-5, -3) // -3 (less negative is larger)
 * max(5, 5) // 5 (returns either when equal)
 *
 * // Common use: Finding maximums, ensuring minimums
 * const finalScore = max(calculatedScore, 0) // No negative scores
 * const displaySize = max(minSize, requestedSize)
 *
 * // With arrays, use Math.max(...array) or array.reduce
 * const highest = [1, 5, 3, 9, 2].reduce((a, b) => max(a, b))
 */
export const max = <A extends number, B extends number>(a: A, b: B): Max<A, B> => {
  return Math.max(a, b) as Max<A, B>
}

/**
 * Create a function that finds the maximum with a fixed first value.
 * Useful for ensuring minimum values.
 *
 * @category Comparison
 * @see {@link max}
 * @param a - The fixed first value to compare
 * @returns A function that takes b and returns max(a, b)
 */
export const maxWith = Fn.curry(max)

/**
 * Find the greatest common divisor (GCD) of two integers.
 * The GCD is the largest positive integer that divides both numbers evenly.
 * Also known as the greatest common factor (GCF).
 *
 * @category Number Theory
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math#static_methods}
 * @param a - The first integer
 * @param b - The second integer
 * @returns The greatest common divisor as a positive integer
 *
 * @example
 * import { from as int } from './int/__.js'
 *
 * gcd(int(12), int(8)) // 4 (both 12 and 8 are divisible by 4)
 * gcd(int(15), int(25)) // 5 (both 15 and 25 are divisible by 5)
 * gcd(int(7), int(13)) // 1 (7 and 13 are coprime - no common factors)
 * gcd(int(24), int(36)) // 12
 * gcd(int(-12), int(8)) // 4 (works with negative numbers)
 *
 * // Common use: Simplifying fractions, finding common units
 * const numerator = int(8), denominator = int(12)
 * const divisor = gcd(numerator, denominator)
 * const simplified = `${numerator/divisor}/${denominator/divisor}` // "2/3"
 *
 * // Finding aspect ratios:
 * const commonFactor = gcd(int(width), int(height))
 * const aspectRatio = `${width/commonFactor}:${height/commonFactor}`
 */
export const gcd = (a: Int, b: Int): Natural => {
  let aAbs = Math.abs(a)
  let bAbs = Math.abs(b)

  // Handle edge case where both are 0
  if (aAbs === 0 && bAbs === 0) {
    throw new Error('GCD of 0 and 0 is undefined')
  }

  // If one is 0, return the other
  if (aAbs === 0) return bAbs as Natural
  if (bAbs === 0) return aAbs as Natural

  while (bAbs !== 0) {
    const temp = bAbs
    bAbs = aAbs % bAbs
    aAbs = temp
  }
  return aAbs as Natural
}

/**
 * Create a function that finds the GCD with a fixed first value.
 * Useful for finding common factors with a specific number.
 *
 * @category Number Theory
 * @see {@link gcd}
 * @param a - The fixed first number
 * @returns A function that takes b and returns gcd(a, b)
 */
export const gcdWith = Fn.curry(gcd)

/**
 * Find the least common multiple (LCM) of two integers.
 * The LCM is the smallest positive integer that is divisible by both numbers.
 * Returns 0 if either input is 0.
 *
 * @category Number Theory
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math#static_methods}
 * @param a - The first integer
 * @param b - The second integer
 * @returns The least common multiple as a non-negative integer
 *
 * @example
 * import { from as int } from './int/__.js'
 *
 * lcm(int(4), int(6)) // 12 (smallest number divisible by both 4 and 6)
 * lcm(int(3), int(5)) // 15 (3 and 5 have no common factors)
 * lcm(int(12), int(18)) // 36
 * lcm(int(7), int(7)) // 7 (LCM of a number with itself is the number)
 * lcm(int(-4), int(6)) // 12 (works with negative numbers)
 * lcm(int(0), int(5)) // 0 (LCM with 0 is 0)
 *
 * // Common use: Finding common periods, synchronizing cycles
 * const task1Interval = int(3) // runs every 3 minutes
 * const task2Interval = int(5) // runs every 5 minutes
 * const bothRunTogether = lcm(task1Interval, task2Interval) // 15 minutes
 *
 * // Working with fractions:
 * const commonDenominator = lcm(int(denominator1), int(denominator2))
 */
export const lcm = (a: Int, b: Int): Whole => {
  // Handle edge case where either is 0
  if (a === 0 || b === 0) {
    return 0 as Whole
  }

  return (Math.abs(a * b) / gcd(a, b)) as Whole
}

/**
 * Create a function that finds the LCM with a fixed first value.
 * Useful for finding common multiples with a specific number.
 *
 * @category Number Theory
 * @see {@link lcm}
 * @param a - The fixed first number
 * @returns A function that takes b and returns lcm(a, b)
 */
export const lcmWith = Fn.curry(lcm)

/**
 * The mathematical constant pi (π).
 * Pi is the ratio of a circle's circumference to its diameter.
 * Approximately 3.14159...
 *
 * @category Constants
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/PI}
 * @example
 * // Circle calculations:
 * const circumference = 2 * PI * radius
 * const area = PI * radius * radius
 *
 * // Converting to radians:
 * const halfCircle = PI // 180 degrees
 * const quarterCircle = PI / 2 // 90 degrees
 * const fullCircle = 2 * PI // 360 degrees
 */
export const PI = Math.PI

/**
 * The mathematical constant e (Euler's number).
 * The base of natural logarithms, approximately 2.71828...
 * It appears naturally in exponential growth and compound interest.
 *
 * @category Constants
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/E}
 * @example
 * // Exponential growth:
 * const growth = power(E, rate * time)
 *
 * // Natural logarithm relationships:
 * log(E) // 1
 * power(E, 2) // e squared, about 7.389
 *
 * // Compound interest (continuous):
 * const finalAmount = principal * power(E, rate * time)
 */
export const E = Math.E

/**
 * The mathematical constant tau (τ).
 * Tau is 2π, representing a full circle in radians.
 * Some mathematicians prefer tau over pi for circular calculations.
 * Approximately 6.28318...
 *
 * @category Constants
 * @see {@link PI}
 * @example
 * // Full rotation:
 * const fullRotation = TAU // 360 degrees
 * const halfRotation = TAU / 2 // 180 degrees (same as PI)
 * const quarterRotation = TAU / 4 // 90 degrees
 *
 * // Sine wave period:
 * sin(TAU * progress) // Complete one full cycle as progress goes 0 to 1
 *
 * // Circle calculations (alternative to PI):
 * const circumference = TAU * radius // Instead of 2 * PI * radius
 */
export const TAU = 2 * Math.PI

/**
 * The golden ratio (φ, phi).
 * A special number appearing in nature, art, and architecture.
 * When a line is divided so that the whole length divided by the long part
 * equals the long part divided by the short part.
 * Approximately 1.61803...
 *
 * @category Constants
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math#static_properties}
 * @example
 * // Golden rectangle:
 * const width = 100
 * const height = width / GOLDEN_RATIO // About 61.8
 *
 * // Fibonacci approximation:
 * // As Fibonacci numbers get larger, their ratio approaches the golden ratio
 * // 13/8 = 1.625, 21/13 = 1.615, 34/21 = 1.619...
 *
 * // Design and layout:
 * const sidebarWidth = totalWidth / GOLDEN_RATIO
 * const contentWidth = totalWidth - sidebarWidth
 */
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2
