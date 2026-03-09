/**
 * Enhanced test utilities for table-driven testing with Vitest.
 *
 * Provides builder API and type-safe utilities for parameterized tests with
 * built-in support for todo, skip, and only cases.
 *
 * @example Basic table-driven testing with builder API
 * ```typescript
 * const add = (a: number, b: number) => a + b
 *
 * Test.describe('addition')
 *   .on(add)
 *   .cases(
 *     [[2, 3], 5],
 *     [[0, 0], 0],
 *     [[-1, 1], 0]
 *   )
 *   .test()
 * ```
 *
 * @example Custom test logic
 * ```typescript
 * Test.describe('validation')
 *   .i<string>()
 *   .o<boolean>()
 *   .cases(
 *     { n: 'valid email', i: 'user@example.com', o: true },
 *     { n: 'invalid', i: 'not-email', o: false },
 *     { n: 'future feature', todo: 'Not implemented yet' }
 *   )
 *   .test((input, expected) => {
 *     expect(isValid(input)).toBe(expected)
 *   })
 * ```
 *
 * @example Property-based testing
 * ```typescript
 * Test.property(
 *   'reversing array twice returns original',
 *   fc.array(fc.integer()),
 *   (arr) => {
 *     const reversed = arr.slice().reverse()
 *     const reversedTwice = reversed.slice().reverse()
 *     expect(reversedTwice).toEqual(arr)
 *   }
 * )
 * ```
 *
 * @category Utils
 */
// @ts-expect-error Duplicate identifier
export * as Test from './__.js'

/**
 * Namespace anchor for {@link Test}.
 */
export namespace Test {}
