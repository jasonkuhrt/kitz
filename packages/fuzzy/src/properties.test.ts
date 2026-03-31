/**
 * Property-based tests tying hasMatch, score, and positions together.
 *
 * Invariants verified:
 * 1. hasMatch(n, h) = true  →  score(n, h) is Some
 * 2. hasMatch(n, h) = false →  score(n, h) is None
 * 3. hasMatch(n, h) = true  →  positions(n, h) is Some with length = needle.length
 * 4. positions returns indices that reconstruct the needle (case-insensitive)
 * 5. positions indices are unique (no double-counting)
 * 6. positions indices are within bounds [0, haystack.length)
 */
import { Option } from 'effect'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { Test } from '@kitz/test'
import { Fuzzy } from './_.js'

// ASCII-printable strings for readable test output
const shortString = fc.string({ minLength: 0, maxLength: 20 })
const asciiString = fc.string()

Test.property(
  'hasMatch = true implies score is Some',
  shortString,
  shortString,
  (needle, haystack) => {
    if (Fuzzy.hasMatch(needle, haystack)) {
      expect(Option.isSome(Fuzzy.score(needle, haystack))).toBe(true)
    }
  },
)

Test.property(
  'hasMatch = false implies score is None',
  shortString,
  shortString,
  (needle, haystack) => {
    if (!Fuzzy.hasMatch(needle, haystack)) {
      expect(Option.isNone(Fuzzy.score(needle, haystack))).toBe(true)
    }
  },
)

Test.property(
  'hasMatch = true implies positions length equals needle length',
  shortString,
  shortString,
  (needle, haystack) => {
    if (Fuzzy.hasMatch(needle, haystack)) {
      const pos = Fuzzy.positions(needle, haystack)
      expect(Option.isSome(pos)).toBe(true)
      expect(Option.getOrThrow(pos)).toHaveLength(needle.length)
    }
  },
)

Test.property('positions indices are unique', shortString, shortString, (needle, haystack) => {
  if (Fuzzy.hasMatch(needle, haystack)) {
    const pos = Option.getOrThrow(Fuzzy.positions(needle, haystack))
    expect(new Set(pos).size).toBe(pos.length)
  }
})

Test.property(
  'positions indices are within bounds',
  shortString,
  shortString,
  (needle, haystack) => {
    if (Fuzzy.hasMatch(needle, haystack)) {
      const pos = Option.getOrThrow(Fuzzy.positions(needle, haystack))
      for (const idx of pos) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(haystack.length)
      }
    }
  },
)

Test.property(
  'positions reconstruct needle characters (case-insensitive)',
  shortString,
  shortString,
  (needle, haystack) => {
    if (Fuzzy.hasMatch(needle, haystack)) {
      const pos = Option.getOrThrow(Fuzzy.positions(needle, haystack))
      for (let i = 0; i < needle.length; i++) {
        expect(haystack[pos[i]!]!.toLowerCase()).toBe(needle[i]!.toLowerCase())
      }
    }
  },
)

Test.property('empty needle always matches with score 0', asciiString, (haystack) => {
  expect(Fuzzy.hasMatch('', haystack)).toBe(true)
  expect(Option.getOrThrow(Fuzzy.score('', haystack))).toBe(0)
  expect(Option.getOrThrow(Fuzzy.positions('', haystack))).toEqual([])
})
