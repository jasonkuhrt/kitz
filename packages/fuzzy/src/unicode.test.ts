/**
 * Unicode case-folding edge cases.
 *
 * @kitz/fuzzy uses ASCII-only case folding (A-Z → a-z). Non-ASCII letters
 * are compared as-is. This is deliberate — the README behavioral contract
 * states "No Unicode case folding or normalization."
 *
 * These tests make that policy explicit so it's intentional, not accidental.
 */
import { Test } from '@kitz/test'
import { Option } from 'effect'
import { expect, test } from 'bun:test'
import { Fuzzy } from './_.js'

// ASCII case folding works
Test.describe('ASCII case folding')
  .on(Fuzzy.hasMatch)
  // dprint-ignore
  .cases([['abc', 'ABC'], true], [['ABC', 'abc'], true], [['aBc', 'AbC'], true])
  .test()

// Non-ASCII: same character matches (no folding needed)
test('non-ASCII: exact match works', () => {
  expect(Fuzzy.hasMatch('é', 'café')).toBe(true)
  expect(Fuzzy.hasMatch('ñ', 'mañana')).toBe(true)
  expect(Fuzzy.hasMatch('ü', 'über')).toBe(true)
})

// Non-ASCII: different case does NOT match (ASCII-only folding)
test('non-ASCII: case variants do NOT match (ASCII-only folding)', () => {
  // é (U+00E9) vs É (U+00C9) — not folded
  expect(Fuzzy.hasMatch('É', 'café')).toBe(false)
  expect(Fuzzy.hasMatch('é', 'CAFÉ')).toBe(false)

  // ñ (U+00F1) vs Ñ (U+00D1) — not folded
  expect(Fuzzy.hasMatch('Ñ', 'mañana')).toBe(false)
})

// Mixed ASCII + non-ASCII
test('mixed ASCII and non-ASCII', () => {
  // ASCII part folds, non-ASCII part must match exactly
  expect(Fuzzy.hasMatch('cé', 'Café')).toBe(true) // c folds to match C, é exact match
  expect(Fuzzy.hasMatch('CÉ', 'café')).toBe(false) // C folds to c ✓, É ≠ é ✗
})

// Non-ASCII classified as Letter (CharClass.Letter)
test('non-ASCII letters classified correctly for boundary bonuses', () => {
  // 'ü' after a delimiter should get a boundary bonus
  const result = Fuzzy.score('ü', '-über')
  expect(Option.isSome(result)).toBe(true)
  // Position should be at 1 (after delimiter '-')
  const pos = Fuzzy.positions('ü', '-über')
  expect(Option.isSome(pos)).toBe(true)
  expect(Option.getOrThrow(pos)).toEqual([1])
})
