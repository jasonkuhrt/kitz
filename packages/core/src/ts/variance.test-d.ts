import { test } from 'bun:test'

/**
 * Type-level tests for variance phantom types
 */

import type * as Variance from './variance-phantom.js'

// Helper container type for testing
interface Container<T> {
  readonly __type?: T
}

// ====================================================================
//                         Variance Tests
// ====================================================================

test('Covariant - allows narrow → wide (subtype → supertype)', () => {
  type Narrow = Container<Variance.Co<1>>
  type Wide = Container<Variance.Co<number>>

  let narrow: Narrow = {}
  let wide: Wide = {}

  wide = narrow // ✓ OK: 1 → number

  // @ts-expect-error - Cannot assign wide → narrow
  narrow = wide
})

test('Contravariant - allows wide → narrow (supertype → subtype)', () => {
  type Narrow = Container<Variance.Contra<1>>
  type Wide = Container<Variance.Contra<number>>

  let narrow: Narrow = {}
  let wide: Wide = {}

  narrow = wide // ✓ OK: number → 1 (contravariance)

  // @ts-expect-error - Cannot assign narrow → wide
  wide = narrow
})

test('Invariant - exact match only', () => {
  type One = Container<Variance.In<1>>
  type Num = Container<Variance.In<number>>

  let one: One = {}
  let num: Num = {}

  // @ts-expect-error - Cannot assign either direction
  num = one

  // @ts-expect-error - Cannot assign either direction
  one = num

  // Only exact match works
  let one2: One = {}
  one = one2 // ✓ OK
})

test('Bivariant - allows both directions (unsafe)', () => {
  type Narrow = Container<Variance.Bi<1>>
  type Wide = Container<Variance.Bi<number>>

  let narrow: Narrow = {}
  let wide: Wide = {}

  wide = narrow // ✓ OK (covariant direction)
  narrow = wide // ✓ OK (contravariant direction - unsafe!)
})

test('Covariant with string literals', () => {
  type Hello = Container<Variance.Co<'hello'>>
  type Str = Container<Variance.Co<string>>

  let hello: Hello = {}
  let str: Str = {}

  str = hello // ✓ OK: 'hello' → string

  // @ts-expect-error
  hello = str
})

test('Contravariant with string literals', () => {
  type Hello = Container<Variance.Contra<'hello'>>
  type Str = Container<Variance.Contra<string>>

  let hello: Hello = {}
  let str: Str = {}

  hello = str // ✓ OK: string → 'hello' (contravariance)

  // @ts-expect-error
  str = hello
})
