import { Equivalence } from 'effect'
import { Schema as S } from 'effect'

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
  toBeEquivalent<A, I = A, R = never>(expected: A, schema: S.Codec<A, I, R>): R

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

export {}
