/**
 * Complex number brand and operations.
 * A complex number is a number that can be expressed as a + bi where a and b are real numbers and i is the imaginary unit.
 */

import { Fn } from '@kitz/core'

import type { Brand } from 'effect'

/**
 * Complex number - a number with both real and imaginary parts, written as a + bi.
 *
 * The 'i' represents the imaginary unit, which is the square root of -1.
 * Complex numbers extend regular numbers to solve problems that regular numbers can't,
 * like finding the square root of negative numbers.
 *
 * Common uses:
 * - **Signal processing**: Analyzing sound waves and digital signals
 * - **Electrical engineering**: Calculating power in AC circuits
 * - **Physics**: Describing quantum states and wave behavior
 * - **Computer graphics**: Rotating points and creating fractals
 * - **Control systems**: Analyzing system stability
 *
 * @example
 * // Basic complex numbers:
 * const z1 = Complex.from(3, 4)     // 3 + 4i
 * const z2 = Complex.from(0, 1)     // pure imaginary: 0 + 1i
 * const z3 = Complex.from(5, 0)     // real number: 5 + 0i
 * const z4 = Complex.from(-2, -3)   // -2 - 3i
 *
 * // The imaginary unit 'i' has the special property: i² = -1
 * Complex.multiply(Complex.I, Complex.I) // gives -1 + 0i
 */
export type Complex = {
  readonly real: number
  readonly imaginary: number
} & Brand.Brand<'Complex'>

/**
 * Type predicate to check if value is a Complex number.
 *
 * @param value - The value to check
 * @returns True if value is a Complex number
 *
 * @example
 * is({ real: 3, imaginary: 4 }) // true
 * is({ real: 0, imaginary: 1 }) // true (pure imaginary)
 * is({ real: 5, imaginary: 0 }) // true (real number)
 * is(3) // false (not a Complex object)
 * is({ real: 'a', imaginary: 4 }) // false (invalid real part)
 */
export const is = (value: unknown): value is Complex => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'real' in value &&
    'imaginary' in value &&
    typeof value.real === 'number' &&
    typeof value.imaginary === 'number' &&
    Number.isFinite(value.real) &&
    Number.isFinite(value.imaginary)
  )
}

/**
 * Construct a Complex number from real and imaginary parts.
 *
 * @param real - The real part
 * @param imaginary - The imaginary part (default: 0)
 * @returns The complex number
 *
 * @example
 * from(3, 4) // 3 + 4i
 * from(5, 0) // 5 + 0i (real number)
 * from(0, 1) // 0 + 1i (pure imaginary)
 * from(-2, -3) // -2 - 3i
 *
 * // Electrical engineering: impedance
 * const resistance = from(50, 0) // 50Ω resistor
 * const capacitor = from(0, -100) // 100Ω capacitive reactance
 * const inductor = from(0, 75) // 75Ω inductive reactance
 */
export const from = (real: number, imaginary: number = 0): Complex => {
  if (!Number.isFinite(real) || !Number.isFinite(imaginary)) {
    throw new Error('Complex number parts must be finite')
  }

  return {
    real,
    imaginary,
  } as Complex
}

/**
 * Create a function that constructs complex numbers with a fixed real part.
 * Useful for creating pure imaginary numbers or series.
 *
 * @param real - The fixed real part
 * @returns A function that creates complex numbers with the given real part
 *
 * @example
 * const realFive = fromWith(5)
 * realFive(3) // 5 + 3i
 * realFive(0) // 5 + 0i (real number)
 * realFive(-2) // 5 - 2i
 */
export const fromWith = Fn.curry(from)

/**
 * Create a function that constructs complex numbers with a fixed imaginary part.
 * Useful for creating real numbers or series with constant imaginary component.
 *
 * @param imaginary - The fixed imaginary part
 * @returns A function that creates complex numbers with the given imaginary part
 *
 * @example
 * const imaginaryTwo = fromOn(2)
 * imaginaryTwo(3) // 3 + 2i
 * imaginaryTwo(0) // 0 + 2i (pure imaginary)
 * imaginaryTwo(-1) // -1 + 2i
 */
export const fromOn = Fn.flipCurried(Fn.curry(from))

/**
 * Create a real complex number (imaginary part = 0).
 *
 * @param real - The real value
 * @returns Complex number with zero imaginary part
 *
 * @example
 * real(5) // 5 + 0i
 * real(-3.14) // -3.14 + 0i
 * real(0) // 0 + 0i (zero)
 */
export const real = (real: number): Complex => from(real, 0)

/**
 * Create a pure imaginary complex number (real part = 0).
 *
 * @param imaginary - The imaginary value
 * @returns Complex number with zero real part
 *
 * @example
 * imaginary(3) // 0 + 3i
 * imaginary(-2) // 0 - 2i
 * imaginary(1) // 0 + 1i (the imaginary unit)
 */
export const imaginary = (imaginary: number): Complex => from(0, imaginary)

/**
 * The imaginary unit i (0 + 1i).
 * Satisfies i² = -1.
 *
 * @example
 * multiply(I, I) // -1 + 0i (i² = -1)
 * power(I, 4) // 1 + 0i (i⁴ = 1)
 */
export const I = imaginary(1)

/**
 * Zero complex number (0 + 0i).
 */
export const ZERO = from(0, 0)

/**
 * One complex number (1 + 0i).
 */
export const ONE = from(1, 0)

/**
 * Add two complex numbers together.
 *
 * When adding complex numbers, you add the real parts together and the imaginary parts together.
 * Formula: (a + bi) + (c + di) = (a + c) + (b + d)i
 *
 * @param a - First complex number to add
 * @param b - Second complex number to add
 * @returns A new complex number that is the sum of a and b
 *
 * @example
 * const z1 = Complex.from(3, 4)  // 3 + 4i
 * const z2 = Complex.from(1, 2)  // 1 + 2i
 * const sum = Complex.add(z1, z2) // 4 + 6i
 *
 * // Adding a real and imaginary number
 * Complex.add(Complex.from(5, 0), Complex.from(0, 3)) // 5 + 3i
 *
 * // Real-world: combining electrical impedances in series
 * const resistor = Complex.from(50, 0)    // 50Ω resistor
 * const capacitor = Complex.from(0, -30)  // 30Ω capacitive reactance
 * const totalImpedance = Complex.add(resistor, capacitor) // 50 - 30i Ω
 */
export const add = (a: Complex, b: Complex): Complex => {
  return from(a.real + b.real, a.imaginary + b.imaginary)
}

/**
 * Create a function that adds its input to a specific complex number.
 *
 * This is the data-first curried version where the input becomes the first parameter.
 * Useful for operations where you want to add various numbers to a fixed base value.
 *
 * @param a - The complex number that other numbers will be added to
 * @returns A function that adds its input to the complex number a
 *
 * @example
 * // Create a function that adds to 5+3i
 * const addToBase = Complex.addOn(Complex.from(5, 3))
 * addToBase(Complex.from(1, 1)) // 6 + 4i (adds 1+1i to 5+3i)
 * addToBase(Complex.from(2, -1)) // 7 + 2i (adds 2-1i to 5+3i)
 *
 * // Useful for accumulator patterns
 * const accumulator = Complex.addOn(Complex.from(10, 0))
 * const results = [Complex.from(1, 1), Complex.from(2, 2)].map(accumulator)
 * // results: [11+1i, 12+2i]
 */
export const addOn = Fn.curry(add)

/**
 * Create a function that adds a specific complex number to other complex numbers.
 *
 * This is the data-second curried version where the fixed value is added to various inputs.
 * Useful when you want to add the same complex number to many different values.
 *
 * @param b - The complex number that will be added to other numbers
 * @returns A function that adds the complex number b to its input
 *
 * @example
 * // Create a function that adds the imaginary unit 'i'
 * const addI = Complex.addWith(Complex.I)
 * addI(Complex.from(3, 0)) // 3 + 1i (adds i to 3)
 * addI(Complex.from(2, 2)) // 2 + 3i (adds i to 2+2i)
 *
 * // Create a function that adds 1+2i to other numbers
 * const addConstant = Complex.addWith(Complex.from(1, 2))
 * addConstant(Complex.from(3, 4)) // 4 + 6i
 *
 * // Useful for array operations
 * const numbers = [Complex.from(1, 0), Complex.from(2, 1)]
 * const shifted = numbers.map(Complex.addWith(Complex.from(0, 1))) // adds i to each
 */
export const addWith = Fn.flipCurried(Fn.curry(add))

/**
 * Subtract two complex numbers.
 * (a + bi) - (c + di) = (a - c) + (b - d)i
 *
 * @param a - First complex number (minuend)
 * @param b - Second complex number (subtrahend)
 * @returns The difference
 *
 * @example
 * subtract(from(5, 7), from(2, 3)) // 3 + 4i
 * subtract(from(1, 0), from(0, 1)) // 1 - 1i
 */
export const subtract = (a: Complex, b: Complex): Complex => {
  return from(a.real - b.real, a.imaginary - b.imaginary)
}

/**
 * Create a function that subtracts from a specific complex number.
 *
 * @param a - The complex number to subtract from
 * @returns A function that subtracts its input from the complex number
 *
 * @example
 * const subtractFromOne = subtractWith(ONE)
 * subtractFromOne(from(0, 1)) // 1 - 1i
 */
export const subtractWith = Fn.curry(subtract)

/**
 * Create a function that subtracts from a specific complex number.
 *
 * This is the data-first curried version where the input becomes the subtrahend.
 * Useful for operations where you want to subtract various numbers from a fixed value.
 *
 * @param a - The complex number to subtract from (minuend)
 * @returns A function that subtracts its input from the complex number a
 *
 * @example
 * const subtractFromTen = subtractOn(from(10, 0))
 * subtractFromTen(from(3, 0)) // 7 + 0i (10 - 3)
 * subtractFromTen(from(0, 5)) // 10 - 5i (10 - 5i)
 */
export const subtractOn = Fn.curry(subtract)

/**
 * Multiply two complex numbers.
 * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 *
 * @param a - First complex number
 * @param b - Second complex number
 * @returns The product
 *
 * @example
 * multiply(from(3, 4), from(1, 2)) // -5 + 10i
 * multiply(I, I) // -1 + 0i (i² = -1)
 * multiply(from(2, 0), from(3, 1)) // 6 + 2i (scalar multiplication)
 *
 * // 2D rotation: multiply by e^(iθ) = cos(θ) + i*sin(θ)
 * const point = from(1, 0) // point at (1, 0)
 * const rotation90 = from(0, 1) // 90° rotation
 * const rotated = multiply(point, rotation90) // (0, 1)
 */
export const multiply = (a: Complex, b: Complex): Complex => {
  const real = a.real * b.real - a.imaginary * b.imaginary
  const imaginary = a.real * b.imaginary + a.imaginary * b.real
  return from(real, imaginary)
}

/**
 * Create a function that multiplies a specific complex number by others.
 *
 * This is the data-first curried version where the input becomes the second factor.
 * Useful for operations where you want to multiply a fixed base by various values.
 *
 * @param a - The complex number to be multiplied (first factor)
 * @returns A function that multiplies the complex number a by its input
 *
 * @example
 * // Create a function that multiplies 3+4i by other numbers
 * const multiplyBase = Complex.multiplyOn(Complex.from(3, 4))
 * multiplyBase(Complex.from(2, 0)) // 6 + 8i (multiplies 3+4i by 2)
 * multiplyBase(Complex.I) // -4 + 3i (multiplies 3+4i by i)
 *
 * // Useful for calculating multiples
 * const baseValue = Complex.multiplyOn(Complex.from(5, 2))
 * const multiples = [1, 2, 3].map(n => baseValue(Complex.from(n, 0)))
 * // Results: [5+2i, 10+4i, 15+6i]
 */
export const multiplyOn = Fn.curry(multiply)

/**
 * Create a function that multiplies with a specific complex number.
 *
 * This is the data-second curried version where the fixed multiplier is applied to various inputs.
 * Useful when you want to scale or rotate many complex numbers by the same amount.
 * In 2D graphics, multiplying by a complex number rotates and scales points around the origin.
 *
 * @param b - The complex number to multiply with (multiplier)
 * @returns A function that multiplies its input with the complex number
 *
 * @example
 * // Scaling: double all values
 * const double = Complex.multiplyWith(Complex.from(2, 0))
 * double(Complex.from(3, 4)) // 6 + 8i
 * double(Complex.from(1, 1)) // 2 + 2i
 *
 * // Rotation: rotate by 90 degrees counterclockwise
 * const rotateBy90 = Complex.multiplyWith(Complex.I)
 * rotateBy90(Complex.from(1, 0)) // 0 + 1i (point moves from x-axis to y-axis)
 * rotateBy90(Complex.from(0, 1)) // -1 + 0i (point moves from y-axis to negative x-axis)
 *
 * // Array processing: scale all points in a polygon
 * const points = [Complex.from(1, 0), Complex.from(0, 1), Complex.from(-1, 0)]
 * const scaled = points.map(Complex.multiplyWith(Complex.from(2, 0))) // doubles all coordinates
 */
export const multiplyWith = Fn.flipCurried(Fn.curry(multiply))

/**
 * Divide two complex numbers.
 * (a + bi) / (c + di) = [(a + bi)(c - di)] / (c² + d²)
 *
 * @param a - First complex number (dividend)
 * @param b - Second complex number (divisor)
 * @returns The quotient
 * @throws Error if divisor is zero
 *
 * @example
 * divide(from(1, 1), from(1, -1)) // 0 + 1i
 * divide(from(6, 8), from(2, 0)) // 3 + 4i (division by real)
 * divide(ONE, I) // 0 - 1i (1/i = -i)
 */
export const divide = (a: Complex, b: Complex): Complex => {
  const denominator = b.real * b.real + b.imaginary * b.imaginary
  if (denominator === 0) {
    throw new Error('Cannot divide by zero complex number')
  }

  const real = (a.real * b.real + a.imaginary * b.imaginary) / denominator
  const imaginary = (a.imaginary * b.real - a.real * b.imaginary) / denominator
  return from(real, imaginary)
}

/**
 * Create a function that divides from a specific complex number.
 *
 * This creates a function where the provided complex number is the dividend (numerator)
 * and the function's input becomes the divisor (denominator).
 *
 * @param a - The complex number to divide from (dividend)
 * @returns A function that divides the complex number by its input
 *
 * @example
 * // Calculate reciprocals: 1/z for various z
 * const divideOneBy = Complex.divideWith(Complex.ONE)
 * divideOneBy(Complex.I) // 0 - 1i (1/i = -i)
 * divideOneBy(Complex.from(2, 0)) // 0.5 + 0i (1/2 = 0.5)
 * divideOneBy(Complex.from(1, 1)) // 0.5 - 0.5i (1/(1+i))
 *
 * // Calculate how many times a value fits into a fixed amount
 * const divideTenBy = Complex.divideWith(Complex.from(10, 0))
 * divideTenBy(Complex.from(2, 0)) // 5 + 0i (10/2 = 5)
 * divideTenBy(Complex.from(1, 1)) // 5 - 5i (10/(1+i))
 */

export const divideWith = Fn.curry(divide)

/**
 * Create a function that divides a specific complex number by others.
 *
 * This is the data-first curried version where the input becomes the divisor.
 * Useful for operations where you want to divide a fixed dividend by various values.
 *
 * @param a - The complex number to be divided (dividend)
 * @returns A function that divides the complex number a by its input
 *
 * @example
 * // Create a function that divides 10+0i by other numbers
 * const divideTenBy = Complex.divideOn(Complex.from(10, 0))
 * divideTenBy(Complex.from(2, 0)) // 5 + 0i (10/2 = 5)
 * divideTenBy(Complex.from(1, 1)) // 5 - 5i (10/(1+i))
 *
 * // Calculate reciprocals: 1/z for various z
 * const divideOneBy = Complex.divideOn(Complex.ONE)
 * divideOneBy(Complex.I) // 0 - 1i (1/i = -i)
 * divideOneBy(Complex.from(2, 0)) // 0.5 + 0i (1/2 = 0.5)
 */
export const divideOn = Fn.curry(divide)

/**
 * Get the complex conjugate by flipping the sign of the imaginary part.
 *
 * The complex conjugate is useful for:
 * - Converting division into multiplication (z/w = z*w̄/|w|²)
 * - Finding the magnitude squared (z*z̄ = |z|²)
 * - Extracting real parts from complex expressions
 *
 * If z = a + bi, then z* = a - bi
 *
 * @param z - The complex number
 * @returns The complex conjugate with imaginary part sign flipped
 *
 * @example
 * Complex.conjugate(Complex.from(3, 4)) // 3 - 4i
 * Complex.conjugate(Complex.from(0, 5)) // 0 - 5i (pure imaginary)
 * Complex.conjugate(Complex.from(2, 0)) // 2 + 0i (real numbers are self-conjugate)
 * Complex.conjugate(Complex.from(-1, -3)) // -1 + 3i
 *
 * // Useful property: z * z̄ = |z|² (magnitude squared)
 * const z = Complex.from(3, 4)
 * const magSquared = Complex.multiply(z, Complex.conjugate(z)) // 25 + 0i (|3+4i|² = 25)
 *
 * // Division using conjugate: (a+bi)/(c+di) = (a+bi)(c-di)/(c²+d²)
 * const numerator = Complex.from(1, 1)
 * const denominator = Complex.from(1, 2)
 * const conjugateDenom = Complex.conjugate(denominator)
 * // This helps convert division into simpler operations
 */

export const conjugate = (z: Complex): Complex => {
  return from(z.real, z.imaginary === 0 ? 0 : -z.imaginary)
}

/**
 * Get the absolute value (magnitude/modulus) of a complex number.
 *
 * The magnitude represents the distance from the origin to the point in the complex plane.
 * This is always a non-negative real number, calculated using the Pythagorean theorem.
 *
 * Formula: |a + bi| = √(a² + b²)
 *
 * @param z - The complex number
 * @returns The magnitude as a non-negative real number
 *
 * @example
 * Complex.abs(Complex.from(3, 4)) // 5 (3-4-5 right triangle)
 * Complex.abs(Complex.from(0, 5)) // 5 (pure imaginary number)
 * Complex.abs(Complex.from(-2, 0)) // 2 (absolute value of real number)
 * Complex.abs(Complex.ZERO) // 0 (distance from origin to origin)
 *
 * // Distance calculation: how far is this point from the origin?
 * const z = Complex.from(3, 4)
 * const distance = Complex.abs(z) // 5 units from origin
 *
 * // Engineering: calculating impedance magnitude in AC circuits
 * const impedance = Complex.from(50, 30) // 50Ω resistance + 30Ω reactance
 * const magnitude = Complex.abs(impedance) // ~58.3Ω total impedance
 *
 * // Checking if numbers are "close" to zero
 * const smallNumber = Complex.from(1e-10, 1e-10)
 * Complex.abs(smallNumber) < 1e-9 // true (effectively zero)
 */

export const abs = (z: Complex): number => {
  return Math.sqrt(z.real * z.real + z.imaginary * z.imaginary)
}

/**
 * Get the argument (phase/angle) of a complex number in radians.
 *
 * The argument is the angle from the positive real axis to the line connecting
 * the origin to the complex number, measured counterclockwise.
 * This is essential for polar form representation and rotation operations.
 *
 * Formula: arg(a + bi) = atan2(b, a)
 *
 * @param z - The complex number
 * @returns The argument in radians, ranging from -π to π
 * @throws Error if z is zero (argument is undefined for zero)
 *
 * @example
 * Complex.arg(Complex.from(1, 0)) // 0 (positive real axis, 0°)
 * Complex.arg(Complex.from(0, 1)) // π/2 (positive imaginary axis, 90°)
 * Complex.arg(Complex.from(-1, 0)) // π (negative real axis, 180°)
 * Complex.arg(Complex.from(0, -1)) // -π/2 (negative imaginary axis, -90°)
 * Complex.arg(Complex.from(1, 1)) // π/4 (first quadrant, 45°)
 * Complex.arg(Complex.from(-1, -1)) // -3π/4 (third quadrant, -135°)
 *
 * // Converting to degrees for display
 * const z = Complex.from(1, 1)
 * const angleInDegrees = Complex.arg(z) * 180 / Math.PI // 45°
 *
 * // Finding rotation needed to align with real axis
 * const point = Complex.from(3, 4)
 * const rotationAngle = -Complex.arg(point) // negative to rotate clockwise back to real axis
 *
 * // Signal processing: phase of a frequency component
 * const signal = Complex.from(0.6, 0.8) // amplitude 1, phase ~53°
 * const phase = Complex.arg(signal) // ~0.927 radians (53.13°)
 */

export const arg = (z: Complex): number => {
  if (z.real === 0 && z.imaginary === 0) {
    throw new Error('Argument of zero is undefined')
  }
  return Math.atan2(z.imaginary, z.real)
}

/**
 * Convert complex number to polar form (magnitude, angle).
 *
 * Polar form represents a complex number as r*e^(iθ) where r is the magnitude
 * and θ is the angle. This form is especially useful for multiplication and
 * power operations, as it turns them into simple arithmetic on the components.
 *
 * @param z - The complex number to convert
 * @returns Object with magnitude (distance from origin) and angle (in radians)
 *
 * @example
 * Complex.toPolar(Complex.from(1, 1)) // { magnitude: √2 ≈ 1.414, angle: π/4 ≈ 0.785 }
 * Complex.toPolar(Complex.from(0, 3)) // { magnitude: 3, angle: π/2 ≈ 1.571 }
 * Complex.toPolar(Complex.from(-2, 0)) // { magnitude: 2, angle: π ≈ 3.142 }
 * Complex.toPolar(Complex.from(3, -4)) // { magnitude: 5, angle: ≈ -0.927 }
 *
 * // Converting for easier multiplication: z1 * z2 = r1*r2 * e^(i(θ1+θ2))
 * const z1 = Complex.from(2, 2)
 * const polar1 = Complex.toPolar(z1) // { magnitude: 2√2, angle: π/4 }
 *
 * // Engineering: converting impedance to polar form for analysis
 * const impedance = Complex.from(300, 400) // 300Ω + j400Ω
 * const polar = Complex.toPolar(impedance) // { magnitude: 500Ω, angle: 0.927 rad }
 */

export const toPolar = (z: Complex): { magnitude: number; angle: number } => {
  return {
    magnitude: abs(z),
    angle: arg(z),
  }
}

/**
 * Create complex number from polar form (magnitude, angle).
 *
 * This converts from polar coordinates (r, θ) to rectangular coordinates (a, bi)
 * using Euler's formula: r*e^(iθ) = r(cos θ + i sin θ)
 *
 * @param magnitude - The magnitude (r) - distance from origin, must be non-negative
 * @param angle - The angle in radians (θ) - measured counterclockwise from positive real axis
 * @returns Complex number r * e^(iθ) = r(cos θ + i sin θ)
 *
 * @example
 * Complex.fromPolar(1, 0) // 1 + 0i (unit on real axis)
 * Complex.fromPolar(1, Math.PI/2) // 0 + 1i (unit on imaginary axis)
 * Complex.fromPolar(2, Math.PI) // -2 + 0i (magnitude 2 on negative real axis)
 * Complex.fromPolar(Math.sqrt(2), Math.PI/4) // 1 + 1i (45° angle)
 * Complex.fromPolar(5, -Math.PI/3) // 2.5 - 4.33i (300° or -60°)
 *
 * // Creating unit vectors for rotation
 * const rotate90 = Complex.fromPolar(1, Math.PI/2) // i (90° rotation)
 * const rotate45 = Complex.fromPolar(1, Math.PI/4) // (1+i)/√2 (45° rotation)
 *
 * // Signal processing: creating sinusoid at specific phase
 * const amplitude = 10
 * const phase = Math.PI/3 // 60° phase shift
 * const phasor = Complex.fromPolar(amplitude, phase) // 5 + 8.66i
 */

export const fromPolar = (magnitude: number, angle: number): Complex => {
  if (!Number.isFinite(magnitude) || !Number.isFinite(angle)) {
    throw new Error('Polar components must be finite')
  }
  if (magnitude < 0) {
    throw new Error('Magnitude must be non-negative')
  }

  return from(magnitude * Math.cos(angle), magnitude * Math.sin(angle))
}

/**
 * Raise a complex number to a real power using De Moivre's theorem.
 *
 * This uses the polar form to compute powers efficiently:
 * If z = r*e^(iθ), then z^n = r^n * e^(inθ)
 * This avoids the complexity of repeated multiplication for integer powers.
 *
 * @param z - The complex base number
 * @param n - The real exponent (can be fractional for roots)
 * @returns z raised to the power n
 *
 * @example
 * // Powers of the imaginary unit demonstrate cyclic behavior
 * Complex.power(Complex.I, 1) // 0 + 1i (i¹ = i)
 * Complex.power(Complex.I, 2) // -1 + 0i (i² = -1)
 * Complex.power(Complex.I, 3) // 0 - 1i (i³ = -i)
 * Complex.power(Complex.I, 4) // 1 + 0i (i⁴ = 1, cycle repeats)
 *
 * // Squaring complex numbers
 * Complex.power(Complex.from(1, 1), 2) // 0 + 2i ((1+i)² = 1 + 2i - 1 = 2i)
 * Complex.power(Complex.from(3, 4), 2) // -7 + 24i
 *
 * // Roots: fractional powers
 * Complex.power(Complex.from(-1, 0), 0.5) // 0 + 1i (√(-1) = i)
 * Complex.power(Complex.from(8, 0), 1/3) // 2 + 0i (∛8 = 2)
 * Complex.power(Complex.from(0, 8), 0.5) // 2 + 2i (√(8i))
 *
 * // Graphics: scaling and rotating simultaneously
 * const point = Complex.from(1, 0)
 * Complex.power(point, 0.5) // shrinks and rotates
 */

export const power = (z: Complex, n: number): Complex => {
  if (!Number.isFinite(n)) {
    throw new Error('Exponent must be finite')
  }

  if (z.real === 0 && z.imaginary === 0) {
    if (n === 0) {
      throw new Error('0^0 is undefined')
    }
    return n > 0 ? ZERO : from(Infinity, 0)
  }

  const magnitude = Math.pow(abs(z), n)
  const angle = arg(z) * n
  return fromPolar(magnitude, angle)
}

/**
 * Create a function that raises a specific complex number to various powers.
 *
 * This is the data-first curried version where the input becomes the exponent.
 * Useful for operations where you want to raise a fixed base to different powers.
 *
 * @param z - The complex base number
 * @returns A function that raises the complex number z to the input power
 *
 * @example
 * // Create a function that raises i to various powers
 * const iPower = Complex.powerOn(Complex.I)
 * iPower(2) // -1 + 0i (i² = -1)
 * iPower(3) // 0 - 1i (i³ = -i)
 * iPower(4) // 1 + 0i (i⁴ = 1)
 *
 * // Powers of a fixed base
 * const basePower = Complex.powerOn(Complex.from(2, 1))
 * basePower(2) // 3 + 4i ((2+i)²)
 * basePower(3) // 2 + 11i ((2+i)³)
 */
export const powerOn = Fn.curry(power)

/**
 * Create a function that raises complex numbers to a specific power.
 *
 * This is the data-second curried version where the fixed exponent is applied to various bases.
 * Useful for applying the same power operation to multiple complex numbers,
 * such as when processing arrays or in mathematical transformations.
 *
 * @param n - The exponent to use for all subsequent operations
 * @returns A function that raises its input to the given power
 *
 * @example
 * // Create specialized power functions
 * const square = Complex.powerWith(2)
 * square(Complex.from(3, 4)) // -7 + 24i ((3+4i)² = -7+24i)
 * square(Complex.I) // -1 + 0i (i² = -1)
 *
 * const cube = Complex.powerWith(3)
 * cube(Complex.from(1, 1)) // -2 + 2i ((1+i)³)
 *
 * // Square root function
 * const sqrt = Complex.powerWith(0.5)
 * sqrt(Complex.from(-1, 0)) // 0 + 1i (√(-1) = i)
 * sqrt(Complex.from(4, 0)) // 2 + 0i (√4 = 2)
 *
 * // Processing arrays: square all elements
 * const numbers = [Complex.from(1, 1), Complex.from(2, 0), Complex.I]
 * const squared = numbers.map(Complex.powerWith(2))
 * // Results: [2i, 4+0i, -1+0i]
 *
 * // Fourth root for finding all solutions to z⁴ = 16
 * const fourthRoot = Complex.powerWith(0.25)
 * fourthRoot(Complex.from(16, 0)) // 2 + 0i (principal root)
 */
export const powerWith = Fn.flipCurried(Fn.curry(power))

/**
 * Get the square root of a complex number.
 *
 * Returns the principal (primary) square root using the power function.
 * The principal root is the one with argument in the range (-π/2, π/2].
 * Note that every non-zero complex number has exactly two square roots.
 *
 * @param z - The complex number to find the square root of
 * @returns The principal square root
 *
 * @example
 * Complex.sqrt(Complex.from(-1, 0)) // 0 + 1i (√(-1) = i)
 * Complex.sqrt(Complex.from(4, 0)) // 2 + 0i (√4 = 2, real positive root)
 * Complex.sqrt(Complex.from(0, 2)) // 1 + 1i (√(2i))
 * Complex.sqrt(Complex.from(-4, 0)) // 0 + 2i (√(-4) = 2i)
 *
 * // Solving quadratic equations: x² + 1 = 0
 * // x = ±√(-1) = ±i
 * const root = Complex.sqrt(Complex.from(-1, 0)) // 0 + 1i (principal root)
 * const otherRoot = Complex.multiply(Complex.from(-1, 0), root) // 0 - 1i (other root)
 *
 * // Finding both square roots
 * const z = Complex.from(3, 4)
 * const root1 = Complex.sqrt(z) // principal root
 * const root2 = Complex.multiply(Complex.from(-1, 0), root1) // other root
 * // Verify: root1² = root2² = z
 */

export const sqrt = (z: Complex): Complex => {
  return power(z, 0.5)
}

/**
 * Natural exponential function for complex numbers.
 *
 * Uses Euler's formula: e^(a + bi) = e^a * (cos b + i sin b)
 * This fundamental function connects exponentials with trigonometry and
 * is essential for signal processing, quantum mechanics, and many areas of mathematics.
 *
 * @param z - The complex exponent
 * @returns e raised to the complex power z
 *
 * @example
 * // Euler's famous identity: e^(iπ) + 1 = 0
 * Complex.exp(Complex.from(0, Math.PI)) // -1 + 0i (e^(iπ) = -1)
 *
 * // Real exponential (imaginary part = 0)
 * Complex.exp(Complex.from(1, 0)) // e + 0i (e^1 = e ≈ 2.718)
 * Complex.exp(Complex.from(2, 0)) // e² + 0i ≈ 7.389
 *
 * // Pure imaginary exponential creates rotation
 * Complex.exp(Complex.from(0, Math.PI/2)) // 0 + 1i (e^(iπ/2) = i, 90° rotation)
 * Complex.exp(Complex.from(0, Math.PI/4)) // 0.707 + 0.707i (45° rotation)
 *
 * // Combined: scaling and rotation
 * Complex.exp(Complex.from(1, Math.PI/2)) // 0 + ei ≈ 0 + 2.718i (scale by e, rotate 90°)
 *
 * // Signal processing: creating complex sinusoids
 * const frequency = 1
 * const time = 0.5
 * const signal = Complex.exp(Complex.from(0, 2 * Math.PI * frequency * time))
 * // Creates sinusoidal signal at given frequency and time
 */

export const exp = (z: Complex): Complex => {
  const magnitude = Math.exp(z.real)
  return fromPolar(magnitude, z.imaginary)
}

/**
 * Natural logarithm for complex numbers.
 *
 * Uses the formula: log(z) = log|z| + i*arg(z)
 * This gives the principal branch of the complex logarithm.
 * Note that complex logarithms are multi-valued; this returns the principal value.
 *
 * @param z - The complex number (must be non-zero)
 * @returns The principal natural logarithm
 * @throws Error if z is zero (logarithm undefined)
 *
 * @example
 * // Real logarithms
 * Complex.log(Complex.from(Math.E, 0)) // 1 + 0i (log(e) = 1)
 * Complex.log(Complex.from(1, 0)) // 0 + 0i (log(1) = 0)
 * Complex.log(Complex.from(10, 0)) // ln(10) + 0i ≈ 2.303 + 0i
 *
 * // Negative real numbers
 * Complex.log(Complex.from(-1, 0)) // 0 + πi (log(-1) = iπ)
 * Complex.log(Complex.from(-Math.E, 0)) // 1 + πi (log(-e) = 1 + iπ)
 *
 * // Pure imaginary
 * Complex.log(Complex.I) // 0 + (π/2)i (log(i) = iπ/2)
 * Complex.log(Complex.from(0, -1)) // 0 - (π/2)i (log(-i) = -iπ/2)
 *
 * // General complex numbers
 * Complex.log(Complex.from(1, 1)) // ln(√2) + (π/4)i ≈ 0.347 + 0.785i
 *
 * // Inverse of exponential: log(exp(z)) = z (principal branch)
 * const z = Complex.from(2, 1)
 * const roundTrip = Complex.log(Complex.exp(z)) // should equal z
 */

export const log = (z: Complex): Complex => {
  if (z.real === 0 && z.imaginary === 0) {
    throw new Error('Logarithm of zero is undefined')
  }

  return from(Math.log(abs(z)), arg(z))
}

/**
 * Check if two complex numbers are equal within a tolerance.
 *
 * Due to floating-point arithmetic limitations, exact equality is rarely achievable
 * for computed complex numbers. This function allows for small differences that
 * arise from numerical precision issues.
 *
 * @param a - First complex number
 * @param b - Second complex number
 * @param tolerance - Maximum allowed difference for each component (default: 1e-9)
 * @returns True if both real and imaginary parts are within tolerance
 *
 * @example
 * // Exact equality
 * Complex.equals(Complex.from(1, 2), Complex.from(1, 2)) // true
 *
 * // Tiny differences within tolerance
 * Complex.equals(Complex.from(1, 2), Complex.from(1.0000000001, 2)) // true
 * Complex.equals(Complex.from(0, 0), Complex.from(1e-15, 1e-15)) // true
 *
 * // Clear differences
 * Complex.equals(Complex.from(1, 2), Complex.from(1, 3)) // false
 * Complex.equals(Complex.from(1, 2), Complex.from(2, 2)) // false
 *
 * // Custom tolerance for less precise comparisons
 * Complex.equals(Complex.from(1, 2), Complex.from(1.01, 2.01), 0.1) // true
 * Complex.equals(Complex.from(1, 2), Complex.from(1.01, 2.01), 0.001) // false
 *
 * // Useful after calculations that introduce floating-point errors
 * const z1 = Complex.from(1, 0)
 * const z2 = Complex.multiply(Complex.sqrt(z1), Complex.sqrt(z1)) // should equal z1
 * Complex.equals(z1, z2) // true (handles small numerical errors)
 */

export const equals = (a: Complex, b: Complex, tolerance: number = 1e-9): boolean => {
  return Math.abs(a.real - b.real) < tolerance && Math.abs(a.imaginary - b.imaginary) < tolerance
}

/**
 * Create a function that checks if its input equals a specific complex number.
 *
 * This is the data-first curried version where the reference value is the first parameter.
 * Useful for checking if various numbers equal a fixed reference value.
 *
 * @param a - The complex number to compare other values against (reference value)
 * @param tolerance - Maximum allowed difference for each component (default: 1e-9)
 * @returns A function that checks if its input equals the reference complex number
 *
 * @example
 * // Create specialized equality checkers
 * const isZero = Complex.equalsOn(Complex.ZERO)
 * isZero(Complex.from(0, 0)) // true
 * isZero(Complex.from(1e-15, 0)) // true (within tolerance)
 * isZero(Complex.from(0.1, 0)) // false
 *
 * const isOne = Complex.equalsOn(Complex.ONE)
 * isOne(Complex.from(1, 0)) // true
 * isOne(Complex.from(1.0000000001, 0)) // true (within tolerance)
 *
 * // Custom tolerance
 * const isApproxTwo = Complex.equalsOn(Complex.from(2, 0), 0.01)
 * isApproxTwo(Complex.from(2.005, 0)) // true
 * isApproxTwo(Complex.from(2.02, 0)) // false
 */
export const equalsOn = Fn.curry(equals)

/**
 * Create a function that checks equality with a specific complex number.
 *
 * This is the data-second curried version where the comparison value is fixed.
 * Useful for filtering, validation, or when you need to check many numbers
 * against the same reference value.
 *
 * @param b - The complex number to compare against (comparison value)
 * @param tolerance - Maximum allowed difference for each component (default: 1e-9)
 * @returns A function that checks if its input equals the comparison complex number
 *
 * @example
 * // Create specialized equality checkers
 * const equalsZero = Complex.equalsWith(Complex.ZERO)
 * equalsZero(Complex.from(0, 0)) // true
 * equalsZero(Complex.from(1e-15, 0)) // true (within tolerance)
 * equalsZero(Complex.from(0.1, 0)) // false
 *
 * const equalsI = Complex.equalsWith(Complex.I)
 * equalsI(Complex.from(0, 1)) // true
 *
 * // Array filtering: find all zeros in a list
 * const numbers = [Complex.ZERO, Complex.ONE, Complex.from(1e-12, 0), Complex.I]
 * const zeros = numbers.filter(Complex.equalsWith(Complex.ZERO))
 * // Result: [ZERO, from(1e-12, 0)] (both considered zero within tolerance)
 *
 * // Validation: check if calculation results match expected value
 * const expected = Complex.from(2, 3)
 * const isExpected = Complex.equalsWith(expected, 1e-6) // looser tolerance
 * const results = [Complex.from(2.000001, 3), Complex.from(2, 2.999999)]
 * const allMatch = results.every(isExpected) // true
 */
export const equalsWith = Fn.flipCurried(Fn.curry(equals))

/**
 * Convert complex number to string representation.
 *
 * Creates a human-readable string in standard mathematical notation (a + bi).
 * Handles special cases like pure real numbers, pure imaginary numbers,
 * and the imaginary unit to provide clean, readable output.
 *
 * @param z - The complex number to convert
 * @param precision - Number of decimal places to display (default: 6)
 * @returns String representation in mathematical notation
 *
 * @example
 * // General form
 * Complex.toString(Complex.from(3, 4)) // "3 + 4i"
 * Complex.toString(Complex.from(3, -4)) // "3 - 4i"
 * Complex.toString(Complex.from(-2, 5)) // "-2 + 5i"
 * Complex.toString(Complex.from(-2, -5)) // "-2 - 5i"
 *
 * // Special cases
 * Complex.toString(Complex.from(5, 0)) // "5" (pure real)
 * Complex.toString(Complex.from(0, 3)) // "3i" (pure imaginary)
 * Complex.toString(Complex.I) // "i" (imaginary unit)
 * Complex.toString(Complex.from(0, -1)) // "-i" (negative imaginary unit)
 * Complex.toString(Complex.ZERO) // "0" (zero)
 *
 * // With imaginary unit coefficient of 1 or -1
 * Complex.toString(Complex.from(2, 1)) // "2 + i"
 * Complex.toString(Complex.from(2, -1)) // "2 - i"
 *
 * // Custom precision
 * Complex.toString(Complex.from(Math.PI, Math.E), 2) // "3.14 + 2.72i"
 * Complex.toString(Complex.from(1/3, -1/7), 4) // "0.3333 - 0.1429i"
 *
 * // For display in user interfaces or debugging
 * const impedance = Complex.from(50.5, -30.7)
 * console.log(`Impedance: ${Complex.toString(impedance)} Ω`)
 * // Output: "Impedance: 50.5 - 30.7i Ω"
 */

export const toString = (z: Complex, precision: number = 6): string => {
  const realPart = Number(z.real.toFixed(precision))
  const imagPart = Number(z.imaginary.toFixed(precision))

  if (imagPart === 0) {
    return realPart.toString()
  }

  if (realPart === 0) {
    if (imagPart === 1) return 'i'
    if (imagPart === -1) return '-i'
    return `${imagPart}i`
  }

  const imagString = Math.abs(imagPart) === 1 ? 'i' : `${Math.abs(imagPart)}i`

  const sign = imagPart >= 0 ? ' + ' : ' - '
  return `${realPart}${sign}${imagString}`
}
