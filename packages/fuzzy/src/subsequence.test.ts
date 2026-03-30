import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import { subsequenceScore } from './subsequence.js'

// Helper that extracts just the score (null-safe)
const scoreOf = (needle: string, haystack: string) => subsequenceScore(needle, haystack)?.score ?? null

// Helper that extracts just positions
const positionsOf = (needle: string, haystack: string) => subsequenceScore(needle, haystack)?.positions ?? null

Test.describe('subsequenceScore — score')
  .on(scoreOf)
  // dprint-ignore
  .cases(
    // Normative scores from README golden test vectors
    [['cfg', 'Config'],        63],
    [['cr', 'configReload'],   53],
    // Non-subsequence returns null
    [['vdi', 'david'],         null],
    [['cxg', 'Config'],        null],
    // Empty needle
    [['', 'anything'],         0],
    [['', ''],                 0],
  )
  .test()

Test.describe('subsequenceScore — positions')
  .on(positionsOf)
  // dprint-ignore
  .cases(
    [['cfg', 'Config'],        [0, 3, 5]],
    [['cr', 'configReload'],   [0, 6]],
    [['', 'anything'],         []],
    [['vdi', 'david'],         null],
  )
  .test()

Test.describe('subsequenceScore — case insensitive')
  .on(scoreOf)
  .describeInputs('matches regardless of case', [
    ['abc', 'ABC'],
    ['ABC', 'abc'],
    ['AbC', 'aBc'],
  ])
  .test()

test('exact case match scores higher than mismatched case', () => {
  // 'Cfg' exactly matches 'C' in 'Config', while 'cfg' matches 'C' by folding
  const exactCase = subsequenceScore('Cfg', 'Config')
  const foldedCase = subsequenceScore('cfg', 'Config')
  expect(exactCase).not.toBeNull()
  expect(foldedCase).not.toBeNull()
  expect(exactCase!.score).toBeGreaterThan(foldedCase!.score)
})

test('exact match abc/abc has positions [0,1,2]', () => {
  const result = subsequenceScore('abc', 'abc')
  expect(result).not.toBeNull()
  expect(result!.positions).toEqual([0, 1, 2])
})

test('prefers boundary positions over mid-word', () => {
  // 'cr' in 'configReload' should pick C(0) and R(6), not c(0) and r(?)
  const result = subsequenceScore('cr', 'configReload')
  expect(result).not.toBeNull()
  expect(result!.positions).toEqual([0, 6])
})

test('consecutive matches get bonus', () => {
  // 'con' in 'config' — all consecutive — should score well
  const consecutive = subsequenceScore('con', 'config')
  // 'cfg' in 'config' — scattered — compare
  const scattered = subsequenceScore('cfg', 'config')
  expect(consecutive).not.toBeNull()
  expect(scattered).not.toBeNull()
  // Both valid but consecutive should benefit from consecutive chunk rule
})

test('gap penalty: wider gaps score lower', () => {
  // 'ac' in 'abc' (gap of 1) vs 'ac' in 'axxc' (gap of 2)
  const shortGap = subsequenceScore('ac', 'abc')
  const longGap = subsequenceScore('ac', 'axxc')
  expect(shortGap).not.toBeNull()
  expect(longGap).not.toBeNull()
  expect(shortGap!.score).toBeGreaterThan(longGap!.score)
})
