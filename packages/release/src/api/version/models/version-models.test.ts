import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  Candidate,
  CandidateSchema,
  encodeCandidate,
  makeCandidate,
  nextCandidate,
  parseCandidate,
} from './candidate.js'
import {
  encodeEphemeral,
  Ephemeral,
  EphemeralSchema,
  makeEphemeral,
  nextEphemeral,
  parseEphemeral,
} from './ephemeral.js'
import { OfficialFirst } from './official-first.js'
import { OfficialIncrement } from './official-increment.js'

// ── OfficialFirst ────────────────────────────────────────────────────

describe('OfficialFirst', () => {
  test('make and is()', () => {
    const v = OfficialFirst.make({ version: Semver.fromString('0.1.0') })
    expect(v._tag).toBe('OfficialFirst')
    expect(OfficialFirst.is(v)).toBe(true)
  })

  test('schema roundtrip', () => {
    const v = OfficialFirst.make({ version: Semver.fromString('1.0.0') })
    const encoded = Schema.encodeSync(OfficialFirst)(v)
    const decoded = Schema.decodeSync(OfficialFirst)(encoded)
    expect(Semver.equivalence(decoded.version, Semver.fromString('1.0.0'))).toBe(true)
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

  test('fromImpact factory', () => {
    const v = OfficialIncrement.fromImpact(Semver.fromString('1.0.0'), 'patch')
    expect(Semver.equivalence(v.from, Semver.fromString('1.0.0'))).toBe(true)
    expect(Semver.equivalence(v.to, Semver.fromString('1.0.1'))).toBe(true)
    expect(v.bump).toBe('patch')
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

  test('makeCandidate', () => {
    const c = makeCandidate(5)
    expect(c.iteration).toBe(5)
  })

  test('nextCandidate increments iteration', () => {
    const c = makeCandidate(1)
    const next = nextCandidate(c)
    expect(next.iteration).toBe(2)
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
      const result = parseCandidate(input)
      expect(result.iteration).toBe(output)
    })

  test('CandidateSchema encode', () => {
    const c = makeCandidate(3)
    expect(encodeCandidate(c)).toBe('next.3')
  })

  test('invalid format fails decode', () => {
    expect(() => parseCandidate('invalid')).toThrow()
    expect(() => parseCandidate('next.')).toThrow()
    expect(() => parseCandidate('pre.1')).toThrow()
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

  test('makeEphemeral', () => {
    const e = makeEphemeral(99, 2, sha)
    expect(e.prNumber).toBe(99)
    expect(e.iteration).toBe(2)
  })

  test('nextEphemeral increments iteration', () => {
    const e = makeEphemeral(42, 1, sha)
    const newSha = Git.Sha.make('def5678')
    const next = nextEphemeral(e, newSha)
    expect(next.iteration).toBe(2)
    expect(next.prNumber).toBe(42)
    expect(next.sha).toBe('def5678')
  })

  test('EphemeralSchema decode', () => {
    const e = parseEphemeral('pr.42.3.abc1234')
    expect(e.prNumber).toBe(42)
    expect(e.iteration).toBe(3)
    expect(e.sha).toBe('abc1234')
  })

  test('EphemeralSchema encode', () => {
    const e = makeEphemeral(42, 3, sha)
    expect(encodeEphemeral(e)).toBe('pr.42.3.abc1234')
  })

  test('invalid format fails decode', () => {
    expect(() => parseEphemeral('invalid')).toThrow()
    expect(() => parseEphemeral('pr.42.3')).toThrow()
    expect(() => parseEphemeral('pr.abc.3.abc1234')).toThrow()
  })
})
