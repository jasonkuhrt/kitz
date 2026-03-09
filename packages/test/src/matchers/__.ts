import { Equivalence } from 'effect'
import { Schema as S } from 'effect'
import { expect } from 'vitest'

interface CustomMatchers<R = unknown> {
  /**
   * Check if two values are equivalent using Effect Schema equivalence.
   * Works with any Schema that has an equivalence defined.
   *
   * @example
   * ```typescript
   * import { Schema as S } from 'effect'
   *
   * const Person = S.Struct({ name: S.String, age: S.Number })
   * const person1 = { name: 'Alice', age: 30 }
   * const person2 = { name: 'Alice', age: 30 }
   *
   * expect(person1).toBeEquivalent(person2, Person)
   * ```
   */
  toBeEquivalent<A, I = A, R = never>(expected: A, schema: S.Schema<A, I, R>): R

  /**
   * Check if two values are equivalent using a provided equivalence function.
   *
   * @example
   * ```typescript
   * import { Equivalence } from 'effect'
   *
   * const numberEquivalence: Equivalence.Equivalence<number> = (a, b) => Math.abs(a - b) < 0.001
   *
   * expect(3.14159).toBeEquivalentWith(3.14160, numberEquivalence)
   * ```
   */
  toBeEquivalentWith<T>(expected: T, equivalence: Equivalence.Equivalence<T>): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeEquivalent<A, I = A, R = never>(received: A, expected: A, schema: S.Schema<A, I, R>) {
    const equivalence = S.equivalence(schema)
    const pass = equivalence(received, expected)

    // Try to get a string representation if the schema has an encoder
    let receivedStr: string
    let expectedStr: string

    try {
      const encode = S.encodeSync(schema as S.Schema<A, I>)
      receivedStr = JSON.stringify(encode(received))
      expectedStr = JSON.stringify(encode(expected))
    } catch {
      // Fallback to JSON.stringify if encoding fails
      receivedStr = JSON.stringify(received)
      expectedStr = JSON.stringify(expected)
    }

    return {
      pass,
      message: () =>
        pass
          ? `Expected values not to be equivalent:\n  Received: ${receivedStr}\n  Expected: ${expectedStr}`
          : `Expected values to be equivalent:\n  Received: ${receivedStr}\n  Expected: ${expectedStr}`,
    }
  },

  toBeEquivalentWith<T>(received: T, expected: T, equivalence: Equivalence.Equivalence<T>) {
    const pass = equivalence(received, expected)
    const receivedStr = JSON.stringify(received)
    const expectedStr = JSON.stringify(expected)

    return {
      pass,
      message: () =>
        pass
          ? `Expected values not to be equivalent:\n  Received: ${receivedStr}\n  Expected: ${expectedStr}`
          : `Expected values to be equivalent:\n  Received: ${receivedStr}\n  Expected: ${expectedStr}`,
    }
  },
})
