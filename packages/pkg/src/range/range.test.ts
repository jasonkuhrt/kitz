import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as PkgRange from './range.js'

describe('Pkg.Range', () => {
  test('formats comparators through static and instance helpers', () => {
    const comparator = PkgRange.Comparator.make({
      operator: '>=',
      version: Semver.fromString('1.2.3-beta.1+build.5'),
    })

    expect(PkgRange.Comparator.toString(comparator)).toBe('>=1.2.3-beta.1+build.5')
    expect(comparator.toString()).toBe('>=1.2.3-beta.1+build.5')
  })

  test('builds, encodes, and matches semver ranges', () => {
    const range = PkgRange.make(PkgRange.fromString('>=1.0.0'))

    expect(PkgRange.is(range)).toBe(true)
    expect(PkgRange.toString(range)).toBe('>=1.0.0')
    expect(PkgRange.satisfies(Semver.fromString('1.5.0'), range)).toBe(true)
    expect(PkgRange.satisfies(Semver.fromString('0.9.0'), range)).toBe(false)
  })

  test('parses wildcard and multi-set ranges', () => {
    const wildcard = PkgRange.fromString('*')
    const multi = PkgRange.fromString('>=1.0.0 <2.0.0 || >=3.0.0')

    expect(PkgRange.toString(wildcard)).toBe('>=0.0.0')
    expect(PkgRange.toString(PkgRange.make(multi))).toBe('>=1.0.0 <2.0.0 || >=3.0.0')
    expect(multi).toHaveLength(2)
    expect(PkgRange.satisfies(Semver.fromString('1.5.0'), multi)).toBe(true)
    expect(PkgRange.satisfies(Semver.fromString('2.5.0'), multi)).toBe(false)
    expect(PkgRange.satisfies(Semver.fromString('3.1.0'), multi)).toBe(true)
  })

  test('rejects invalid ranges and leaves comparator decode marked todo', () => {
    expect(() => PkgRange.fromString('not a range')).toThrow('Invalid semver range')
    expect(() => Schema.decodeSync(PkgRange.Comparator.Schema)('>=1.0.0')).toThrow(
      'Comparator.Schema decode',
    )
  })
})
