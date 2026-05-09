import { expect } from 'bun:test'
import { Equivalence } from 'effect'
import { Schema as S } from 'effect'

declare module 'bun:test' {
  interface Matchers<T = unknown> {
    /**
     * Check if two values are equivalent using Effect Schema equivalence.
     */
    toBeEquivalent<A, I = A, R = never>(expected: A, schema: S.Codec<A, I, R>): void
    /**
     * Check if two values are equivalent using a provided equivalence function.
     */
    toBeEquivalentWith<U>(expected: U, equivalence: Equivalence.Equivalence<U>): void
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bun:test's CustomMatcher generic prevents a precise typing of expect.extend; the public surface is fully typed via the module augmentation above.
expect.extend({
  toBeEquivalent<A, I = A, R = never>(received: A, expected: A, schema: S.Codec<A, I, R>) {
    const equivalence = S.toEquivalence(schema)
    const pass = equivalence(received, expected)

    let receivedStr: string
    let expectedStr: string

    try {
      const encode = S.encodeSync(schema as S.Codec<A, I>)
      receivedStr = JSON.stringify(encode(received))
      expectedStr = JSON.stringify(encode(expected))
    } catch {
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
} as never)
