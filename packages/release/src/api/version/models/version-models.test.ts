import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Option, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Candidate, CandidateSchema } from './candidate.js'
import { Ephemeral, EphemeralSchema } from './ephemeral.js'
import { Official } from './official.js'
import { OfficialFirst } from './official-first.js'
import { OfficialIncrement } from './official-increment.js'

const decodeCandidate = Schema.decodeSync(CandidateSchema)
const encodeCandidate = Schema.encodeSync(CandidateSchema)
const decodeEphemeral = Schema.decodeSync(EphemeralSchema)
const encodeEphemeral = Schema.encodeSync(EphemeralSchema)

// ── OfficialFirst ────────────────────────────────────────────────────

describe('OfficialFirst', () => {
  test('make and is()', () => {
    const v = OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' })
    expect(v._tag).toBe('OfficialFirst')
    expect(OfficialFirst.is(v)).toBe(true)
  })

  test('schema roundtrip', () => {
    const v = OfficialFirst.make({ version: Semver.fromString('1.0.0'), bump: 'major' })
    const encoded = Schema.encodeSync(OfficialFirst)(v)
    const decoded = Schema.decodeSync(OfficialFirst)(encoded)
    expect(Semver.equivalence(decoded.version, Semver.fromString('1.0.0'))).toBe(true)
    expect(decoded.bump).toBe('major')
  })
})

// ── OfficialIncrement ────────────────────────────────────────────────

describe('OfficialIncrement', () => {
  test('make and is()', () => {
    const v = OfficialIncrement.make({
      from: Semver.fromString('1.0.0'),
      to: Semver.fromString('1.1.0'),
      bump: 'minor',
    })
    expect(v._tag).toBe('OfficialIncrement')
    expect(OfficialIncrement.is(v)).toBe(true)
  })

  test('schema roundtrip', () => {
    const v = OfficialIncrement.make({
      from: Semver.fromString('2.0.0'),
      to: Semver.fromString('3.0.0'),
      bump: 'major',
    })
    const encoded = Schema.encodeSync(OfficialIncrement)(v)
    const decoded = Schema.decodeSync(OfficialIncrement)(encoded)
    expect(decoded.bump).toBe('major')
  })
})

// ── Official.fromCurrent ─────────────────────────────────────────────

describe('Official.fromCurrent', () => {
  test('existing current version yields an increment with the calculated next version', () => {
    const v = Official.fromCurrent(Option.some(Semver.fromString('1.0.0')), 'patch')
    expect(OfficialIncrement.is(v)).toBe(true)
    if (OfficialIncrement.is(v)) {
      expect(Semver.equivalence(v.from, Semver.fromString('1.0.0'))).toBe(true)
      expect(Semver.equivalence(v.to, Semver.fromString('1.0.1'))).toBe(true)
      expect(v.bump).toBe('patch')
    }
  })

  test('no current version yields a first release (initial phase)', () => {
    const minor = Official.fromCurrent(Option.none(), 'minor')
    expect(OfficialFirst.is(minor)).toBe(true)
    if (OfficialFirst.is(minor)) {
      expect(Semver.toString(minor.version)).toBe('0.1.0')
      expect(minor.bump).toBe('minor')
    }

    const patch = Official.fromCurrent(Option.none(), 'patch')
    expect(OfficialFirst.is(patch)).toBe(true)
    if (OfficialFirst.is(patch)) {
      expect(Semver.toString(patch.version)).toBe('0.0.1')
    }
  })

  test('phase-aware bump: major on 0.x.x increments minor', () => {
    const v = Official.fromCurrent(Option.some(Semver.fromString('0.2.0')), 'major')
    expect(OfficialIncrement.is(v)).toBe(true)
    if (OfficialIncrement.is(v)) {
      expect(Semver.toString(v.to)).toBe('0.3.0')
      expect(v.bump).toBe('major')
    }
  })
})

// ── Candidate ────────────────────────────────────────────────────────

describe('Candidate', () => {
  test('make and is()', () => {
    const c = Candidate.make({ iteration: 3 })
    expect(c._tag).toBe('Candidate')
    expect(Candidate.is(c)).toBe(true)
    expect(c.iteration).toBe(3)
  })

  test('calculateVersion', () => {
    const base = Semver.fromString('1.1.0')
    const version = Candidate.calculateVersion(base, 2)
    expect(Semver.toString(version)).toContain('next')
  })

  Test.describe('CandidateSchema decode')
    .inputType<string>()
    .outputType<number>()
    .cases(
      { input: 'next.1', output: 1 },
      { input: 'next.5', output: 5 },
      { input: 'next.100', output: 100 },
    )
    .test(({ input, output }) => {
      const result = decodeCandidate(input)
      expect(result.iteration).toBe(output)
    })

  test('CandidateSchema encode', () => {
    const c = Candidate.make({ iteration: 3 })
    expect(encodeCandidate(c)).toBe('next.3')
  })

  test('invalid format fails decode', () => {
    expect(() => decodeCandidate('invalid')).toThrow(/./)
    expect(() => decodeCandidate('next.')).toThrow(/./)
    expect(() => decodeCandidate('pre.1')).toThrow(/./)
  })
})

// ── Ephemeral ────────────────────────────────────────────────────────

describe('Ephemeral', () => {
  const sha = Git.Sha.make('abc1234')

  test('make and is()', () => {
    const e = Ephemeral.make({ prNumber: 42, iteration: 1, sha })
    expect(e._tag).toBe('Ephemeral')
    expect(Ephemeral.is(e)).toBe(true)
    expect(e.prNumber).toBe(42)
    expect(e.iteration).toBe(1)
  })

  test('calculateVersion', () => {
    const version = Ephemeral.calculateVersion(42, 3, sha)
    const str = Semver.toString(version)
    expect(str).toContain('pr')
    expect(str).toContain('42')
  })

  test('EphemeralSchema decode', () => {
    const e = decodeEphemeral('pr.42.3.abc1234')
    expect(e.prNumber).toBe(42)
    expect(e.iteration).toBe(3)
    expect(e.sha).toBe<string>('abc1234')
  })

  test('EphemeralSchema encode', () => {
    const e = Ephemeral.make({ prNumber: 42, iteration: 3, sha })
    expect(encodeEphemeral(e)).toBe('pr.42.3.gabc1234')
  })

  test('invalid format fails decode', () => {
    expect(() => decodeEphemeral('invalid')).toThrow(/./)
    expect(() => decodeEphemeral('pr.42.3')).toThrow(/./)
    expect(() => decodeEphemeral('pr.abc.3.abc1234')).toThrow(/./)
  })
})
