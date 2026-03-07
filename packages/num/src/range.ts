/**
 * Options for generating numeric ranges.
 */
export interface RangeOptions {
  /**
   * The step between each number in the range.
   * @default 1
   */
  step?: number
  /**
   * Whether to include the end value in the range.
   * @default false
   */
  inclusive?: boolean
}

/**
 * Generate an array of numbers in a range.
 * By default, the range is exclusive of the end value and uses a step of 1.
 *
 * @category Range Generation
 * @param start - The starting value (inclusive)
 * @param end - The ending value (exclusive by default)
 * @param options - Configuration options
 * @returns An array of numbers in the range
 *
 * @example
 * range(0, 5) // [0, 1, 2, 3, 4]
 * range(1, 4) // [1, 2, 3]
 * range(5, 10) // [5, 6, 7, 8, 9]
 *
 * // With step
 * range(0, 10, { step: 2 }) // [0, 2, 4, 6, 8]
 * range(0, 1, { step: 0.25 }) // [0, 0.25, 0.5, 0.75]
 *
 * // Inclusive range
 * range(1, 5, { inclusive: true }) // [1, 2, 3, 4, 5]
 *
 * // Negative step for descending range
 * range(5, 0, { step: -1 }) // [5, 4, 3, 2, 1]
 * range(10, 0, { step: -2 }) // [10, 8, 6, 4, 2]
 */
export const range = (start: number, end: number, options?: RangeOptions): number[] => {
  const { step, inclusive = false } = options ?? {}

  // Determine default step based on direction
  const defaultStep = start <= end ? 1 : -1
  const actualStep = step ?? defaultStep

  if (actualStep === 0) {
    throw new Error('Step cannot be zero')
  }

  const result: number[] = []

  // Determine direction based on start/end and step
  const shouldReverse = (start > end && actualStep > 0) || (start < end && actualStep < 0)
  const effectiveStep = shouldReverse ? -actualStep : actualStep

  // Adjust comparison based on direction
  const comparison =
    effectiveStep > 0
      ? inclusive
        ? (i: number) => i <= end
        : (i: number) => i < end
      : inclusive
        ? (i: number) => i >= end
        : (i: number) => i > end

  // Use index-based iteration to avoid floating point accumulation errors
  let index = 0
  while (true) {
    const current = start + index * effectiveStep
    if (!comparison(current)) break
    result.push(current)
    index++
  }

  return result
}

/**
 * Create a function that generates a range from a specific start value.
 * Useful for creating ranges with a fixed starting point.
 *
 * @category Range Generation
 * @see {@link range}
 * @param start - The starting value
 * @returns A function that takes end and options and returns the range
 *
 * @example
 * const rangeFrom0 = rangeFrom(0)
 * rangeFrom0(5) // [0, 1, 2, 3, 4]
 * rangeFrom0(3) // [0, 1, 2]
 *
 * const rangeFrom1 = rangeFrom(1)
 * rangeFrom1(5) // [1, 2, 3, 4]
 */
export const rangeFrom =
  (start: number) =>
  (end: number, options?: RangeOptions): number[] => {
    return range(start, end, options)
  }

/**
 * Create a function that generates a range to a specific end value.
 * Useful for creating ranges with a fixed ending point.
 *
 * @category Range Generation
 * @see {@link range}
 * @param end - The ending value
 * @returns A function that takes start and options and returns the range
 *
 * @example
 * const rangeTo10 = rangeTo(10)
 * rangeTo10(0) // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 * rangeTo10(5) // [5, 6, 7, 8, 9]
 *
 * const rangeTo5 = rangeTo(5)
 * rangeTo5(1) // [1, 2, 3, 4]
 */
export const rangeTo =
  (end: number) =>
  (start: number, options?: RangeOptions): number[] => {
    return range(start, end, options)
  }

/**
 * Generate a range with a specific step.
 * A convenience function that makes the step explicit.
 *
 * @category Range Generation
 * @param start - The starting value
 * @param end - The ending value
 * @param step - The step between values
 * @returns An array of numbers in the range
 *
 * @example
 * rangeStep(0, 10, 2) // [0, 2, 4, 6, 8]
 * rangeStep(0, 1, 0.1) // [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
 * rangeStep(10, 0, -1) // [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
 */
export const rangeStep = (start: number, end: number, step: number): number[] => {
  return range(start, end, { step })
}

/**
 * Create a function that generates ranges with a specific step.
 * Useful for creating consistent stepped ranges.
 *
 * @category Range Generation
 * @see {@link rangeStep}
 * @param step - The step between values
 * @returns A function that takes start and end and returns the range
 *
 * @example
 * const rangeByTwos = rangeStepWith(2)
 * rangeByTwos(0, 10) // [0, 2, 4, 6, 8]
 * rangeByTwos(1, 10) // [1, 3, 5, 7, 9]
 *
 * const rangeByHalves = rangeStepWith(0.5)
 * rangeByHalves(0, 2) // [0, 0.5, 1, 1.5]
 */
export const rangeStepWith =
  (step: number) =>
  (start: number, end: number): number[] => {
    return rangeStep(start, end, step)
  }

/**
 * Create an inclusive range.
 * A convenience function that always includes the end value.
 *
 * @category Range Generation
 * @param start - The starting value
 * @param end - The ending value (inclusive)
 * @returns An array of numbers from start to end (inclusive)
 *
 * @example
 * rangeInclusive(1, 5) // [1, 2, 3, 4, 5]
 * rangeInclusive(0, 3) // [0, 1, 2, 3]
 * rangeInclusive(5, 1) // [5, 4, 3, 2, 1] (descending)
 */
export const rangeInclusive = (start: number, end: number): number[] => {
  return range(start, end, { inclusive: true })
}

/**
 * Execute a function n times and collect the results.
 * The function receives the current index (0-based) as its argument.
 *
 * @category Iteration
 * @param n - The number of times to execute the function
 * @param fn - The function to execute, receives the current index
 * @returns An array of the function results
 *
 * @example
 * times(3, i => i) // [0, 1, 2]
 * times(5, i => i * 2) // [0, 2, 4, 6, 8]
 * times(4, i => `item-${i}`) // ['item-0', 'item-1', 'item-2', 'item-3']
 *
 * // Generate random numbers
 * times(3, () => Math.random()) // [0.123..., 0.456..., 0.789...]
 *
 * // Create objects
 * times(2, i => ({ id: i, name: `User ${i}` }))
 * // [{ id: 0, name: 'User 0' }, { id: 1, name: 'User 1' }]
 */
export const times = <T>(n: number, fn: (index: number) => T): T[] => {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Times count must be a non-negative integer')
  }

  const result: T[] = []
  for (let i = 0; i < n; i++) {
    result.push(fn(i))
  }
  return result
}

/**
 * Create a function that executes another function n times.
 * Useful for partial application of the times function.
 *
 * @category Iteration
 * @see {@link times}
 * @param fn - The function to execute
 * @returns A function that takes n and returns the results array
 *
 * @example
 * const doubles = timesWith(i => i * 2)
 * doubles(5) // [0, 2, 4, 6, 8]
 * doubles(3) // [0, 2, 4]
 *
 * const randomNumbers = timesWith(() => Math.random())
 * randomNumbers(3) // [0.123..., 0.456..., 0.789...]
 */
export const timesWith =
  <T>(fn: (index: number) => T) =>
  (n: number): T[] => {
    return times(n, fn)
  }

/**
 * Linear interpolation between two values.
 * Calculates a value between start and end based on the interpolation factor t.
 *
 * @category Interpolation
 * @param start - The starting value (when t = 0)
 * @param end - The ending value (when t = 1)
 * @param t - The interpolation factor (typically between 0 and 1)
 * @returns The interpolated value
 *
 * @example
 * lerp(0, 10, 0) // 0 (start)
 * lerp(0, 10, 0.5) // 5 (midpoint)
 * lerp(0, 10, 1) // 10 (end)
 *
 * // Works with negative numbers
 * lerp(-10, 10, 0.5) // 0
 * lerp(5, -5, 0.25) // 2.5
 *
 * // Extrapolation (t outside [0, 1])
 * lerp(0, 10, 1.5) // 15
 * lerp(0, 10, -0.5) // -5
 *
 * // Animation example
 * const animatePosition = (progress: number) => lerp(startX, endX, progress)
 */
export const lerp = (start: number, end: number, t: number): number => {
  // Handle edge cases for infinite values
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    if (t === 0) return start
    if (t === 1) return end
    if (!Number.isFinite(start) && !Number.isFinite(end)) {
      // Both infinite
      if (start === end) return start
      return NaN // Can't interpolate between different infinities
    }
    // One is infinite
    return Number.isFinite(start) ? (t === 0 ? start : end) : t === 1 ? end : start
  }

  // For t = 1, return end exactly to avoid floating point errors
  if (t === 1) return end
  if (t === 0) return start

  // Standard lerp for finite values
  const result = start + (end - start) * t

  // Check for overflow
  if (!Number.isFinite(result)) {
    // If result is infinite but inputs were finite, we had overflow
    return t < 0.5 ? start : end
  }

  return result
}

/**
 * Create a function that linearly interpolates between two fixed values.
 * Useful for creating reusable interpolation functions.
 *
 * @category Interpolation
 * @see {@link lerp}
 * @param start - The starting value
 * @param end - The ending value
 * @returns A function that takes t and returns the interpolated value
 *
 * @example
 * const fadeOpacity = lerpBetween(0, 1)
 * fadeOpacity(0) // 0 (fully transparent)
 * fadeOpacity(0.5) // 0.5 (half opacity)
 * fadeOpacity(1) // 1 (fully opaque)
 *
 * const slidePosition = lerpBetween(100, 500)
 * slidePosition(0.25) // 200
 * slidePosition(0.75) // 400
 */
export const lerpBetween =
  (start: number, end: number) =>
  (t: number): number => {
    return lerp(start, end, t)
  }

/**
 * Map a value from one range to another.
 * Converts a value from the source range [fromMin, fromMax] to the target range [toMin, toMax].
 *
 * @category Range Mapping
 * @param value - The value to map
 * @param fromMin - The minimum of the source range
 * @param fromMax - The maximum of the source range
 * @param toMin - The minimum of the target range
 * @param toMax - The maximum of the target range
 * @returns The mapped value in the target range
 *
 * @example
 * // Map 0-100 to 0-1 (percentage to decimal)
 * mapRange(50, 0, 100, 0, 1) // 0.5
 * mapRange(25, 0, 100, 0, 1) // 0.25
 *
 * // Map temperature Celsius to Fahrenheit
 * mapRange(20, 0, 100, 32, 212) // 68
 *
 * // Map slider position to volume
 * mapRange(75, 0, 100, 0, 255) // 191.25
 *
 * // Reverse mapping
 * mapRange(3, 1, 5, 10, 0) // 5 (inverted range)
 */
export const mapRange = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number => {
  if (fromMin === fromMax) {
    throw new Error('Source range cannot have zero width')
  }

  // Handle edge cases with infinite or very large numbers
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(fromMin) ||
    !Number.isFinite(fromMax) ||
    !Number.isFinite(toMin) ||
    !Number.isFinite(toMax)
  ) {
    return toMin // Default to minimum of target range
  }

  // Handle exact endpoints
  if (value === fromMin) return toMin
  if (value === fromMax) return toMax

  // Check for very large numbers that might cause precision issues
  const fromRange = fromMax - fromMin
  if (
    Math.abs(fromMin) > Number.MAX_SAFE_INTEGER / 2 ||
    Math.abs(fromMax) > Number.MAX_SAFE_INTEGER / 2 ||
    Math.abs(fromRange) < Number.EPSILON
  ) {
    // Fall back to simpler logic for extreme values
    return toMin
  }

  const ratio = (value - fromMin) / fromRange

  // Ensure ratio is finite
  if (!Number.isFinite(ratio)) {
    return toMin
  }

  const result = toMin + ratio * (toMax - toMin)

  // Ensure result is finite
  if (!Number.isFinite(result)) {
    return toMin
  }

  return result
}

/**
 * Create a function that maps values from one range to another.
 * Useful for creating reusable range mapping functions.
 *
 * @category Range Mapping
 * @see {@link mapRange}
 * @param fromMin - The minimum of the source range
 * @param fromMax - The maximum of the source range
 * @param toMin - The minimum of the target range
 * @param toMax - The maximum of the target range
 * @returns A function that takes a value and returns the mapped value
 *
 * @example
 * // Create a percentage to decimal converter
 * const percentToDecimal = mapRangeFrom(0, 100, 0, 1)
 * percentToDecimal(50) // 0.5
 * percentToDecimal(75) // 0.75
 *
 * // Create a normalizer for sensor data
 * const normalizeSensor = mapRangeFrom(-100, 100, 0, 1)
 * normalizeSensor(-100) // 0
 * normalizeSensor(0) // 0.5
 * normalizeSensor(100) // 1
 */
export const mapRangeFrom =
  (fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  (value: number): number => {
    return mapRange(value, fromMin, fromMax, toMin, toMax)
  }

/**
 * Generate a sequence of integers starting from 0.
 * A convenience function equivalent to range(0, n).
 *
 * @category Range Generation
 * @param n - The number of integers to generate
 * @returns An array of integers from 0 to n-1
 *
 * @example
 * sequence(5) // [0, 1, 2, 3, 4]
 * sequence(3) // [0, 1, 2]
 * sequence(0) // []
 *
 * // Common use: Array indices
 * const indices = sequence(array.length)
 */
export const sequence = (n: number): number[] => {
  if (n < 0) {
    throw new Error('Sequence length must be non-negative')
  }
  return range(0, n)
}

/**
 * Constrain a value to be within a range, wrapping around if necessary.
 * Unlike clamp which stops at boundaries, wrap continues from the other side.
 *
 * @category Range Operations
 * @param value - The value to wrap
 * @param min - The minimum of the range
 * @param max - The maximum of the range
 * @returns The wrapped value within [min, max)
 *
 * @example
 * // Basic wrapping
 * wrap(5, 0, 3) // 2 (5 wraps to 2)
 * wrap(7, 0, 5) // 2 (7 wraps to 2)
 * wrap(-1, 0, 5) // 4 (wraps from below)
 *
 * // Angle wrapping (degrees)
 * wrap(370, 0, 360) // 10
 * wrap(-10, 0, 360) // 350
 *
 * // Time wrapping (24-hour clock)
 * wrap(25, 0, 24) // 1 (25:00 becomes 01:00)
 * wrap(-2, 0, 24) // 22 (2 hours before midnight)
 */
export const wrap = (value: number, min: number, max: number): number => {
  if (min >= max) {
    throw new Error('Min must be less than max')
  }

  // Handle edge cases with infinite or very large numbers
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return min // Default to minimum
  }

  const range = max - min

  // Handle very large ranges or values
  if (!Number.isFinite(range)) {
    return min
  }

  // Check for very large numbers that might cause precision issues
  if (
    Math.abs(value) > Number.MAX_SAFE_INTEGER ||
    Math.abs(min) > Number.MAX_SAFE_INTEGER ||
    Math.abs(max) > Number.MAX_SAFE_INTEGER
  ) {
    return min
  }

  // Handle case where value is already in range
  if (value >= min && value < max) {
    return value
  }

  // Use a more robust wrapping algorithm for edge cases
  let wrapped = value - min
  wrapped = wrapped - Math.floor(wrapped / range) * range
  wrapped = wrapped + min

  // Ensure result is strictly less than max due to floating point precision
  // This handles edge cases where modulo results in max due to rounding
  if (wrapped >= max || wrapped < min || !Number.isFinite(wrapped)) {
    wrapped = min
  }

  return wrapped
}

/**
 * Create a function that wraps values within a specific range.
 *
 * @category Range Operations
 * @see {@link wrap}
 * @param min - The minimum of the range
 * @param max - The maximum of the range
 * @returns A function that takes a value and returns the wrapped value
 *
 * @example
 * const wrapAngle = wrapWithin(0, 360)
 * wrapAngle(370) // 10
 * wrapAngle(-45) // 315
 *
 * const wrapHour = wrapWithin(0, 24)
 * wrapHour(25) // 1
 * wrapHour(-3) // 21
 */
export const wrapWithin =
  (min: number, max: number) =>
  (value: number): number => {
    return wrap(value, min, max)
  }
