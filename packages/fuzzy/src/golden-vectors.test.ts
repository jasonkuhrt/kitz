import { Option } from 'effect'
import { expect, test } from 'vitest'
import { Fuzzy } from './_.js'

// =============================================================================
// Golden Test Vectors — Subsequence Path
// =============================================================================

test('cfg / Config — normative: score=63, positions=[0,3,5]', () => {
  expect(Fuzzy.hasMatch('cfg', 'Config')).toBe(true)
  expect(Option.getOrThrow(Fuzzy.score('cfg', 'Config'))).toBe(63)
  expect(Option.getOrThrow(Fuzzy.positions('cfg', 'Config'))).toEqual([0, 3, 5])
})

test('cxg / Config — no match', () => {
  expect(Fuzzy.hasMatch('cxg', 'Config')).toBe(false)
  expect(Option.isNone(Fuzzy.score('cxg', 'Config'))).toBe(true)
  expect(Option.isNone(Fuzzy.positions('cxg', 'Config'))).toBe(true)
})

test('cr / configReload — normative: score=53, positions=[0,6]', () => {
  expect(Fuzzy.hasMatch('cr', 'configReload')).toBe(true)
  expect(Option.getOrThrow(Fuzzy.score('cr', 'configReload'))).toBe(53)
  expect(Option.getOrThrow(Fuzzy.positions('cr', 'configReload'))).toEqual([0, 6])
})

test('empty needle / anything — score=0, positions=[]', () => {
  expect(Fuzzy.hasMatch('', 'anything')).toBe(true)
  expect(Option.getOrThrow(Fuzzy.score('', 'anything'))).toBe(0)
  expect(Option.getOrThrow(Fuzzy.positions('', 'anything'))).toEqual([])
})

test('x / empty haystack — no match', () => {
  expect(Fuzzy.hasMatch('x', '')).toBe(false)
  expect(Option.isNone(Fuzzy.score('x', ''))).toBe(true)
  expect(Option.isNone(Fuzzy.positions('x', ''))).toBe(true)
})

test('abc / abc — exact match', () => {
  expect(Option.isSome(Fuzzy.score('abc', 'abc'))).toBe(true)
  expect(Option.getOrThrow(Fuzzy.positions('abc', 'abc'))).toEqual([0, 1, 2])
})

test('abc / ABC — case-insensitive', () => {
  expect(Option.isSome(Fuzzy.score('abc', 'ABC'))).toBe(true)
  expect(Option.getOrThrow(Fuzzy.positions('abc', 'ABC'))).toEqual([0, 1, 2])
})

test('ABC / abc — case-insensitive reverse', () => {
  expect(Option.isSome(Fuzzy.score('ABC', 'abc'))).toBe(true)
  expect(Option.getOrThrow(Fuzzy.positions('ABC', 'abc'))).toEqual([0, 1, 2])
})

// =============================================================================
// Golden Test Vectors — Assignment Path
// =============================================================================

test('vdi / david — out-of-order match', () => {
  expect(Fuzzy.hasMatch('vdi', 'david')).toBe(true)
  const s = Fuzzy.score('vdi', 'david')
  expect(Option.isSome(s)).toBe(true)
  expect(Option.getOrThrow(s)).toBeGreaterThan(0)
})

test('ll / reload — multiplicity fails', () => {
  expect(Fuzzy.hasMatch('ll', 'reload')).toBe(false)
  expect(Option.isNone(Fuzzy.score('ll', 'reload'))).toBe(true)
})

test('abc / cba — full reversal', () => {
  const s = Fuzzy.score('abc', 'cba')
  expect(Option.isSome(s)).toBe(true)
  expect(Option.getOrThrow(s)).toBeGreaterThan(0)
})

test('abc / acb — one transposition, higher than full reversal', () => {
  const acb = Option.getOrThrow(Fuzzy.score('abc', 'acb'))
  const cba = Option.getOrThrow(Fuzzy.score('abc', 'cba'))
  expect(acb).toBeGreaterThan(cba)
})

// =============================================================================
// Score Ordering Invariants
// =============================================================================

test('subsequence match > out-of-order match', () => {
  const subseq = Option.getOrThrow(Fuzzy.score('ab', 'ab'))
  const ooo = Option.getOrThrow(Fuzzy.score('ab', 'ba'))
  expect(subseq).toBeGreaterThan(ooo)
})

test('shorter candidate scores higher (coverage ratio)', () => {
  const short = Option.getOrThrow(Fuzzy.score('vdi', 'david'))
  const long = Option.getOrThrow(Fuzzy.score('vdi', 'individual'))
  expect(short).toBeGreaterThan(long)
})

test('boundary match scores higher than mid-word', () => {
  // 'cr' in 'configReload' — R is a camelCase boundary
  // 'cr' in 'increase' — r is mid-word
  const boundary = Option.getOrThrow(Fuzzy.score('cr', 'configReload'))
  const midword = Option.getOrThrow(Fuzzy.score('cr', 'increase'))
  expect(boundary).toBeGreaterThan(midword)
})

// =============================================================================
// match() Integration
// =============================================================================

test('match sorts, excludes non-matches, preserves extra fields', () => {
  const results = Fuzzy.match(
    [
      { text: 'Config', id: 1 },
      { text: 'configurable', id: 2 },
      { text: 'xyz', id: 3 },
    ],
    'cfg',
  )
  expect(results.map((r) => r.candidate.id)).not.toContain(3)
  expect(results.length).toBeGreaterThanOrEqual(1)
})

test('consumer boost shifts ranking', () => {
  const results = Fuzzy.match(
    [
      { text: 'Config', boost: 0 },
      { text: 'configurable', boost: 100 },
    ],
    'cfg',
  )
  expect(results[0]!.candidate.text).toBe('configurable')
})

test('out-of-order matches appear in results', () => {
  const results = Fuzzy.match([{ text: 'david' }, { text: 'provide' }, { text: 'xyz' }], 'vdi')
  const texts = results.map((r) => r.candidate.text)
  expect(texts).toContain('david')
  expect(texts).toContain('provide')
  expect(texts).not.toContain('xyz')
})

test('match with empty query returns all with boost-based ordering', () => {
  const results = Fuzzy.match(
    [
      { text: 'a', boost: 1 },
      { text: 'b', boost: 10 },
      { text: 'c', boost: 5 },
    ],
    '',
  )
  expect(results.map((r) => r.candidate.text)).toEqual(['b', 'c', 'a'])
})
