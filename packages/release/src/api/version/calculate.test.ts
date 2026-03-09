import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { calculateNextVersion } from './calculate.js'

const v = Semver.fromString
const some = <T>(value: T) => Option.some(value)
const none = Option.none()

// ── First release (no current version) ───────────────────────────────

describe('calculateNextVersion', () => {
  Test.describe('first release (no current version)')
    .inputType<{ bump: Semver.BumpType }>()
    .outputType<string>()
    .cases(
      { input: { bump: 'major' }, output: '0.1.0', comment: 'major -> 0.1.0 (initial phase)' },
      { input: { bump: 'minor' }, output: '0.1.0', comment: 'minor -> 0.1.0 (initial phase)' },
      { input: { bump: 'patch' }, output: '0.0.1', comment: 'patch -> 0.0.1' },
    )
    .test(({ input, output }) => {
      const result = calculateNextVersion(none, input.bump)
      expect(Semver.equivalence(result, v(output))).toBe(true)
    })

  // ── Phase 0.x.x (initial development) ─────────────────────────────

  Test.describe('0.x.x phase')
    .inputType<{ current: string; bump: Semver.BumpType }>()
    .outputType<string>()
    .cases(
      {
        input: { current: '0.2.0', bump: 'major' },
        output: '0.3.0',
        comment: 'major absorbed to minor',
      },
      { input: { current: '0.2.0', bump: 'minor' }, output: '0.3.0', comment: 'minor stays minor' },
      { input: { current: '0.2.1', bump: 'patch' }, output: '0.2.2', comment: 'patch stays patch' },
      { input: { current: '0.0.1', bump: 'minor' }, output: '0.1.0', comment: 'minor from 0.0.x' },
      {
        input: { current: '0.0.1', bump: 'major' },
        output: '0.1.0',
        comment: 'major from 0.0.x absorbed',
      },
    )
    .test(({ input, output }) => {
      const result = calculateNextVersion(some(v(input.current)), input.bump)
      expect(Semver.equivalence(result, v(output))).toBe(true)
    })

  // ── Phase 1.x.x+ (official semver) ────────────────────────────────

  Test.describe('1.x.x+ phase (standard semver)')
    .inputType<{ current: string; bump: Semver.BumpType }>()
    .outputType<string>()
    .cases(
      { input: { current: '1.2.3', bump: 'major' }, output: '2.0.0', comment: 'major -> major' },
      { input: { current: '1.2.3', bump: 'minor' }, output: '1.3.0', comment: 'minor -> minor' },
      { input: { current: '1.2.3', bump: 'patch' }, output: '1.2.4', comment: 'patch -> patch' },
      { input: { current: '2.0.0', bump: 'patch' }, output: '2.0.1', comment: 'major version > 1' },
      {
        input: { current: '3.5.2', bump: 'minor' },
        output: '3.6.0',
        comment: 'higher major version',
      },
    )
    .test(({ input, output }) => {
      const result = calculateNextVersion(some(v(input.current)), input.bump)
      expect(Semver.equivalence(result, v(output))).toBe(true)
    })

  // ── Edge cases ─────────────────────────────────────────────────────

  test('returns a Semver value (type check)', () => {
    const result = calculateNextVersion(some(v('1.0.0')), 'patch')
    expect(Semver.toString(result)).toBe('1.0.1')
  })
})
