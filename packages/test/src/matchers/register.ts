import { Equivalence } from 'effect'
import { Schema as S } from 'effect'
import { expect } from 'vitest'

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
})
