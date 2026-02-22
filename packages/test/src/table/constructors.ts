import { Fn } from '@kitz/core'
import { Option } from 'effect'
import * as Types from './builder-types.js'
import * as Builder from './builder.js'

/**
 * Creates a test table builder for testing a specific function.
 *
 * This is a shorthand for `describe().on(fn)` when you don't need a describe block.
 * Types are automatically inferred from the function signature, making it ideal for
 * quick function testing with minimal boilerplate.
 *
 * ## Case Formats
 *
 * Test cases can be specified in multiple formats:
 *
 * **Tuple Format** (most common):
 * - `[[arg1, arg2], expected]` - Test with expected output
 * - `[[arg1, arg2], expected, { comment: 'name' }]` - Named test case (context is 3rd element)
 * - `[[arg1, arg2]]` - Snapshot test (no expected value)
 *
 * **Object Format** (more verbose but clearer):
 * - `{ input: [arg1, arg2], output: expected }`
 * - `{ input: [arg1, arg2], output: expected, skip: true, comment: 'name' }`
 * - `{ todo: 'Not implemented yet', comment: 'name' }`
 *
 * @example
 * ```ts
 * // Basic function testing
 * Test.on(add)
 *   .cases(
 *     [[2, 3], 5],                    // add(2, 3) === 5
 *     [[0, 0], 0],                    // add(0, 0) === 0
 *     [[-1, 1], 0]                    // add(-1, 1) === 0
 *   )
 *   .test()
 *
 * // Using different case formats
 * Test.on(multiply)
 *   .cases(
 *     [[2, 3], 6],                              // Tuple format
 *     [[5, 0], 0, { comment: 'zero case' }],    // Named tuple with context
 *     { input: [-2, 3], output: -6 },           // Object format
 *     { input: [100, 100], output: 10000, comment: 'large numbers' }
 *   )
 *   .test()
 *
 * // Custom assertions
 * Test.on(divide)
 *   .cases([[10, 2], 5], [[10, 0], Infinity])
 *   .test(({ result, output }) => {
 *     if (output === Infinity) {
 *       expect(result).toBe(Infinity)
 *     } else {
 *       expect(result).toBeCloseTo(output, 2)
 *     }
 *   })
 *
 * // Output transformation - build full expectations from partials
 * Test.on(createUser)
 *   .onOutput((partial, context) => ({ ...defaultUser, name: context.input[0], ...partial }))
 *   .cases(
 *     [['Alice'], { role: 'admin' }],           // Only specify differences
 *     [['Bob'], { role: 'user', age: 30 }]
 *   )
 *   .test()
 * ```
 *
 * ## Snapshot Mode with Error Handling
 *
 * When no expected output is provided, tests automatically run in snapshot mode.
 * Errors thrown during execution are automatically caught and included in snapshots
 * with clear "THEN THROWS" vs "THEN RETURNS" formatting:
 *
 * @example
 * ```ts
 * // Mix successful and error cases - errors are captured automatically
 * Test.on(parseInt)
 *   .cases(
 *     ['42'],      // Returns: 42
 *     ['hello'],   // Returns: NaN
 *   )
 *   .test()
 *
 * // Validation functions - errors documented in snapshots
 * Test.on(Positive.from)
 *   .cases(
 *     [1], [10], [100],        // THEN RETURNS the value
 *     [0], [-1], [-10],        // THEN THROWS "Value must be positive"
 *   )
 *   .test()
 * ```
 *
 * ## Promise Auto-Awaiting
 *
 * Functions that return promises are automatically awaited in snapshot mode.
 * The snapshot label indicates whether the promise resolved or rejected:
 *
 * @example
 * ```ts
 * // Async functions - promises are automatically awaited
 * const asyncUpperCase = (s: string) => Promise.resolve(s.toUpperCase())
 *
 * Test.on(asyncUpperCase)
 *   .cases([['hello']], [['world']])
 *   .test()
 * // Snapshot: "THEN RETURNS PROMISE RESOLVING TO STRING"
 *
 * // Async functions that reject
 * const asyncFail = (s: string) => Promise.reject(new Error('Failed'))
 *
 * Test.on(asyncFail)
 *   .cases([['test']])
 *   .test()
 * // Snapshot: "THEN RETURNS PROMISE REJECTING TO ERROR"
 * ```
 *
 * ## Snapshot Format
 *
 * Snapshot format shows arguments and results clearly:
 * ```
 * ╔══════════════════════════════════════════════════╗ GIVEN ARGUMENTS
 * 1
 * ╠══════════════════════════════════════════════════╣ THEN RETURNS NUMBER
 * 1
 * ╚══════════════════════════════════════════════════╝
 * ```
 *
 * For errors:
 * ```
 * ╔══════════════════════════════════════════════════╗ GIVEN ARGUMENTS
 * -1
 * ╠══════════════════════════════════════════════════╣ THEN THROWS ERROR
 * Error: Value must be positive
 * ╚══════════════════════════════════════════════════╝
 * ```
 *
 * For resolved promises:
 * ```
 * ╔══════════════════════════════════════════════════╗ GIVEN ARGUMENTS
 * hello
 * ╠══════════════════════════════════════════════════╣ THEN RETURNS PROMISE RESOLVING TO STRING
 * HELLO
 * ╚══════════════════════════════════════════════════╝
 * ```
 *
 * @param $fn - The function to test. Types are inferred from its signature
 * @returns A {@link TestBuilder} for configuring and running tests
 *
 * @see {@link describe} for creating tests with a describe block
 *
 * @builder
 * @category Test Builders
 */
export function on<$fn extends Fn.AnyAny>(
  $fn: $fn,
): Types.TestBuilder<Types.UpdateState<Types.BuilderTypeStateEmpty, { fn: $fn }>> {
  const initialState = {
    ...Builder.defaultState,
    fn: Option.some($fn),
  }
  return Builder.create(initialState) as any
}

/**
 * Creates a test table builder for property-based and example-based testing.
 *
 * **CRITICAL**: The builder supports chaining multiple `.describe(name, cases)` calls to organize
 * related test groups. Each `.describe()` adds a new test group and returns the builder for
 * continued chaining. The chain must end with `.test()` to execute all groups.
 *
 * Test tables allow you to define multiple test cases with inputs and expected outputs,
 * reducing boilerplate and making tests more maintainable. The builder supports two modes:
 *
 * ## Modes
 *
 * **Function Mode** - Test a specific function with `.on(fn)`:
 * - Types are automatically inferred from the function signature
 * - Test cases specify function arguments and expected return values
 * - Default assertion compares actual vs expected using Effect's equality
 *
 * **Generic Mode** - Define custom types with `.inputType<T>()` and `.outputType<U>()`:
 * - Explicitly specify input and output types
 * - Provide custom test logic to validate cases
 * - Useful for testing complex behaviors beyond simple function calls
 *
 * ## Features
 *
 * **Nested Describes** - Use ` > ` separator to create nested describe blocks:
 * - `Test.describe('Parent > Child')` creates `describe('Parent', () => describe('Child', ...))`
 * - Chain multiple `.describe()` calls: each adds a test group under its specified path
 * - Supports any depth: `'API > Users > Create'` creates three levels
 *
 * **Matrix Testing** - Use `.matrix()` to run cases across parameter combinations:
 * - Generates cartesian product of all matrix value arrays
 * - Each test case runs once for each combination
 * - Matrix values available as `matrix` in test context
 * - Combines with nested describes for organized test suites
 *
 * @example
 * ```ts
 * // ✅ CORRECT - Chain .describe() calls to add multiple test groups
 * Test
 *   .describe('decodeSync > basic', [
 *     [['1.2.3']],
 *     [['invalid']]
 *   ])
 *   .describe('decodeSync > union', [
 *     [['1.2.3-beta']],
 *     [['1.2.3+build']]
 *   ])
 *   .test()
 *
 * // Alternative: Single describe with all cases
 * Test.describe('decodeSync > basic')
 *   .on(decodeSync)
 *   .cases([['1.2.3']], [['invalid']])
 *   .test()
 *
 * // Function mode - testing a math function
 * Test.describe('addition')
 *   .on(add)
 *   .cases(
 *     [[2, 3], 5],                                  // add(2, 3) should return 5
 *     [[-1, -2], -3, { comment: 'negative' }],      // Named test case with context
 *     [[0, 0], 0]                                   // Edge case
 *   )
 *   .test()  // Uses default assertion (Effect's Equal.equals)
 *
 * // Generic mode - custom validation logic
 * Test.describe('email validation')
 *   .inputType<string>()
 *   .outputType<boolean>()
 *   .cases(
 *     ['user@example.com', true],
 *     ['invalid.com', false],
 *     ['', false]
 *   )
 *   .test(({ input, output }) => {
 *     const result = isValidEmail(input)
 *     expect(result).toBe(output)
 *   })
 *
 * // Nested describe blocks with ' > ' separator - chained
 * Test
 *   .describe('Transform > String', [
 *     ['hello', 'HELLO']
 *   ])
 *   .describe('Transform > Number', [
 *     [42, 42]
 *   ])
 *   .test(({ input, output }) => {
 *     // Custom test logic for both groups
 *     if (typeof input === 'string') {
 *       expect(input.toUpperCase()).toBe(output)
 *     } else {
 *       expect(input).toBe(output)
 *     }
 *   })
 *
 * // Matrix testing - runs each case for all parameter combinations
 * Test.describe('string transform')
 *   .inputType<string>()
 *   .outputType<string>()
 *   .matrix({
 *     uppercase: [true, false],
 *     prefix: ['', 'pre_'],
 *   })
 *   .cases(
 *     ['hello', 'hello'],
 *     ['world', 'world']
 *   )
 *   .test(({ input, output, matrix }) => {
 *     // Runs 4 times (2 cases × 2 uppercase × 2 prefix = 8 tests)
 *     let result = input
 *     if (matrix.prefix) result = matrix.prefix + result
 *     if (matrix.uppercase) result = result.toUpperCase()
 *
 *     let expected = output
 *     if (matrix.prefix) expected = matrix.prefix + expected
 *     if (matrix.uppercase) expected = expected.toUpperCase()
 *
 *     expect(result).toBe(expected)
 *   })
 * ```
 *
 * @param description - Optional description for the test suite. Supports ` > ` separator for nested describe blocks.
 * @returns A {@link TestBuilder} for chaining configuration, cases, and execution
 *
 * @see {@link on} for function mode without a describe block
 * @see {@link TestBuilder.matrix matrix()} for matrix testing documentation
 *
 * @builder
 * @category Test Builders
 */
export function describe(description: string, cases: any[]): Types.TestBuilderEmpty

export function describe(description?: string): Types.TestBuilderEmpty

export function describe(description?: string, cases?: any[]): Types.TestBuilderEmpty {
  const initialState = Builder.defaultState
  const builder = Builder.create(initialState)

  // If cases provided, call .describe() method on builder
  if (description && cases) {
    return builder.describe(description, cases)
  }

  // Otherwise, just set description in config
  if (description) {
    return Builder.create({ ...initialState, config: { description } })
  }

  return builder
}
