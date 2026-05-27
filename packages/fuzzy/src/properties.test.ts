/**
 * Property-based tests tying hasMatch, score, and positions together.
 *
 * Invariants verified:
 * 1. hasMatch(n, h) = true  →  score(n, h) is Some
 * 2. hasMatch(n, h) = false →  score(n, h) is None
 * 3. hasMatch(n, h) = true  →  positions(n, h) is Some with length = needle.length for non-token needles
 * 4. positions returns indices that reconstruct the needle (case-insensitive)
 * 5. positions indices are unique (no double-counting)
 * 6. positions indices are within bounds [0, haystack.length)
 */
import { Option } from 'effect'
import * as fc from 'fast-check'
import { expect } from 'bun:test'
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
  'hasMatch = false implies score is None (non-token needles)',
  shortString,
  shortString,
  (needle, haystack) => {
    // Token matching (needle contains spaces) splits on spaces and matches
    // each term independently — score and match can find results that
    // hasMatch rejects (e.g. 'config reload' vs 'configReload'). The
    // hasMatch → score invariant only holds for non-token needles.
    // Cross-API consistency for token needles is tested separately below.
    if (!needle.includes(' ') && !Fuzzy.hasMatch(needle, haystack)) {
      expect(Option.isNone(Fuzzy.score(needle, haystack))).toBe(true)
    }
  },
)

Test.property(
  'score, match, and positions agree on token queries',
  shortString,
  shortString,
  (needle, haystack) => {
    // All three APIs must agree: if score returns Some, match and positions
    // should also return results (and vice versa).
    const s = Fuzzy.score(needle, haystack)
    const m = Fuzzy.match([{ text: haystack }], needle)
    const p = Fuzzy.positions(needle, haystack)

    if (Option.isSome(s)) {
      expect(
        m.length,
        `score=Some but match=[] for (${JSON.stringify(needle)}, ${JSON.stringify(haystack)})`,
      ).toBeGreaterThan(0)
      expect(
        Option.isSome(p),
        `score=Some but positions=None for (${JSON.stringify(needle)}, ${JSON.stringify(haystack)})`,
      ).toBe(true)
    }
    if (m.length > 0) {
      expect(Option.isSome(s), `match has results but score=None`).toBe(true)
    }
    if (Option.isSome(p)) {
      expect(Option.isSome(s), `positions=Some but score=None`).toBe(true)
    }
  },
)

Test.property(
  'hasMatch = true implies positions length equals needle length (non-token needles)',
  shortString,
  shortString,
  (needle, haystack) => {
    if (!needle.includes(' ') && Fuzzy.hasMatch(needle, haystack)) {
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
  'positions reconstruct needle characters (case-insensitive, non-token needles)',
  shortString,
  shortString,
  (needle, haystack) => {
    if (!needle.includes(' ') && Fuzzy.hasMatch(needle, haystack)) {
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
