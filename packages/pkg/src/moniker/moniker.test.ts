import { Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  FromString,
  Scoped,
  ScopedFromString,
  Unscoped,
  UnscopedFromString,
  isScoped,
  isUnscoped,
  parse,
} from './moniker.js'

describe('Pkg.Moniker', () => {
  test('supports scoped package monikers', () => {
    const scoped = Schema.decodeSync(ScopedFromString)('@kitz/core')

    expect(scoped).toBeInstanceOf(Scoped)
    expect(scoped.moniker).toBe('@kitz/core')
    expect(scoped.encoded).toBe('@kitz%2fcore')
    expect(Schema.encodeSync(ScopedFromString)(scoped)).toBe('@kitz/core')
  })

  test('supports unscoped package monikers', () => {
    const unscoped = Schema.decodeSync(UnscopedFromString)('effect')

    expect(unscoped).toBeInstanceOf(Unscoped)
    expect(unscoped.moniker).toBe('effect')
    expect(unscoped.encoded).toBe('effect')
    expect(Schema.encodeSync(UnscopedFromString)(unscoped)).toBe('effect')
  })

  test('parse and type guards discriminate scoped and unscoped names', () => {
    const scoped = parse('@kitz/pkg')
    const unscoped = parse('vitest')

    expect(isScoped(scoped)).toBe(true)
    expect(isUnscoped(scoped)).toBe(false)
    expect(isScoped(unscoped)).toBe(false)
    expect(isUnscoped(unscoped)).toBe(true)
  })

  test('rejects invalid package monikers', () => {
    expect(() => Schema.decodeSync(FromString)('@kitz')).toThrow()
    expect(() => parse('@/pkg')).toThrow()
  })
})

// ─── Derived-arbitrary contract properties ───────────────────────────
//
// The class field grammars are constrained so Schema.toArbitrary generates
// instances whose encoded string form re-parses to the same value (a scope
// containing `/` used to break `@scope/name` reparsing).

import { Test } from '@kitz/test'

const arbScoped = Schema.toArbitrary(Scoped)
const arbUnscoped = Schema.toArbitrary(Unscoped)

Test.property('generated Scoped roundtrips through the string codec', arbScoped, (scoped) => {
  const encoded = Schema.encodeSync(ScopedFromString)(scoped)
  const decoded = Schema.decodeSync(ScopedFromString)(encoded)
  expect(Scoped.equals(decoded, scoped)).toBe(true)
  expect(encoded).toBe(scoped.moniker)
})

Test.property('generated Unscoped roundtrips through the string codec', arbUnscoped, (unscoped) => {
  const encoded = Schema.encodeSync(UnscopedFromString)(unscoped)
  const decoded = Schema.decodeSync(UnscopedFromString)(encoded)
  expect(Unscoped.equals(decoded, unscoped)).toBe(true)
  expect(encoded).toBe(unscoped.moniker)
})
