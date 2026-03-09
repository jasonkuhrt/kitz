import fc from 'fast-check'
import * as Vitest from 'vitest'

/**
 * Create a property-based test using fast-check within vitest.
 *
 * @template Ts - Tuple type of the arbitrary values.
 *
 * @param args - Test arguments in order:
 *   - description: The test description
 *   - arbitraries: Fast-check arbitraries for generating test values
 *   - predicate: Function that should hold true for all generated values
 *
 * @example
 * ```ts
 * // test that array reverse twice returns original
 * property(
 *   'reversing array twice returns original',
 *   fc.array(fc.integer()),
 *   (arr) => {
 *     const reversed = arr.slice().reverse()
 *     const reversedTwice = reversed.slice().reverse()
 *     expect(reversedTwice).toEqual(arr)
 *   }
 * )
 *
 * // test with multiple arbitraries
 * property(
 *   'addition is commutative',
 *   fc.integer(),
 *   fc.integer(),
 *   (a, b) => {
 *     expect(a + b).toBe(b + a)
 *   }
 * )
 * ```
 *
 * @category Property Testing
 */
export const property = <Ts extends [unknown, ...unknown[]]>(
  ...args: [
    description: string,
    ...arbitraries: {
      [K in keyof Ts]: fc.Arbitrary<Ts[K]>
    },
    predicate: (...args: Ts) => boolean | void,
  ]
) => {
  const description = args[0]
  const rest = args.slice(1) as Parameters<typeof fc.property>
  Vitest.test('PROPERTY: ' + description, () => {
    const result = fc.check(fc.property(...rest))

    if (result.failed) {
      // Extract just the useful parts from the fast-check error
      const counterexample =
        result.counterexample
          ?.map((x: unknown) => (typeof x === 'string' ? `"${x}"` : JSON.stringify(x)))
          .join(', ') || ''

      // Get the original error if available
      let assertionError = ''
      const r = result as any
      if (r.error && r.error.message) {
        assertionError = r.error.message
      } else if (r.errorInstance) {
        assertionError = String(r.errorInstance)
      }

      const message = [
        `Property failed: ${description}`,
        `Counterexample: [${counterexample}]`,
        assertionError && `\n${assertionError}`,
        `(seed: ${result.seed})`,
      ]
        .filter(Boolean)
        .join('\n')

      throw new Error(message)
    }
  })
}
