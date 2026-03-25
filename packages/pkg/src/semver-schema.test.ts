import { Semver } from '@kitz/semver'
import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { SemverFromString, SemverSelf } from './semver-schema.js'

describe('Pkg.SemverSchema', () => {
  test('decodes and encodes semver strings', () => {
    const decoded = Schema.decodeSync(SemverFromString)('1.2.3-beta.1+build.5')

    expect(decoded).toEqual(Semver.fromString('1.2.3-beta.1+build.5'))
    expect(Schema.encodeSync(SemverFromString)(decoded)).toBe('1.2.3-beta.1+build.5')
  })

  test('SemverSelf recognizes semver values only', () => {
    expect(Option.isSome(Schema.decodeUnknownOption(SemverSelf)(Semver.fromString('1.0.0')))).toBe(
      true,
    )
    expect(Option.isNone(Schema.decodeUnknownOption(SemverSelf)({ major: 1 }))).toBe(true)
  })

  test('rejects invalid semver strings', () => {
    expect(() => Schema.decodeSync(SemverFromString)('banana')).toThrow('Invalid semver format')
  })
})
