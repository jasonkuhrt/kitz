import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import { assignmentScore } from './assignment.js'

const scoreOf = (needle: string, haystack: string) =>
  assignmentScore(needle, haystack)?.score ?? null
const positionsOf = (needle: string, haystack: string) =>
  assignmentScore(needle, haystack)?.positions ?? null

Test.describe('assignmentScore — returns result for out-of-order matches')
  .on(scoreOf)
  .describeInputs('characters present but not in subsequence order', [
    ['vdi', 'david'],
    ['rc', 'configReload'],
    ['ba', 'ab'],
    ['cba', 'abc'],
  ])
  .test()

Test.describe('assignmentScore — returns null when containment fails')
  .on(scoreOf)
  // dprint-ignore
  .cases(
    [['cxg', 'Config'], null],
    [['ll', 'reload'], null],
    [['xyz', 'hello'], null],
    [['abcdef', 'abc'], null],
  )
  .test()

Test.describe('assignmentScore — empty needle returns score 0')
  .on(scoreOf)
  // dprint-ignore
  .cases([['', 'anything'], 0], [['', ''], 0])
  .test()

test('vdi/david scores higher than vdi/provide (coverage ratio)', () => {
  const david = assignmentScore('vdi', 'david')
  const provide = assignmentScore('vdi', 'provide')
  expect(david).not.toBeNull()
  expect(provide).not.toBeNull()
  expect(david!.score).toBeGreaterThan(provide!.score)
})

test('vdi/david scores higher than vdi/individual (coverage ratio)', () => {
  const david = assignmentScore('vdi', 'david')
  const individual = assignmentScore('vdi', 'individual')
  expect(david).not.toBeNull()
  expect(individual).not.toBeNull()
  expect(david!.score).toBeGreaterThan(individual!.score)
})

test('abc/acb scores higher than abc/cba (order coherence: one transposition vs full reversal)', () => {
  const acb = assignmentScore('abc', 'acb')
  const cba = assignmentScore('abc', 'cba')
  expect(acb).not.toBeNull()
  expect(cba).not.toBeNull()
  expect(acb!.score).toBeGreaterThan(cba!.score)
})

test('positions are returned in needle order', () => {
  const result = assignmentScore('vdi', 'david')
  expect(result).not.toBeNull()
  expect(result!.positions).toHaveLength(3)
  // positions[0] = where 'v' was assigned
  // positions[1] = where 'd' was assigned
  // positions[2] = where 'i' was assigned
  // 'david': d(0), a(1), v(2), i(3), d(4)
  expect(result!.positions[0]).toBe(2) // 'v' at position 2
  expect(result!.positions[2]).toBe(3) // 'i' at position 3
  // 'd' could be at 0 or 4
  expect([0, 4]).toContain(result!.positions[1])
})

test('multiplicity is respected', () => {
  // 'aa' needs two a's
  expect(assignmentScore('aa', 'abba')).not.toBeNull() // two a's available
  expect(assignmentScore('aa', 'abc')).toBeNull() // only one a
})

test('boundary positions are preferred', () => {
  // 'r' in 'configReload': should pick R at position 6 (camelCase boundary)
  // over r at position 8 (mid-word in 'Reload')... wait, 'r' only at pos 6? No...
  // configReload: c(0)o(1)n(2)f(3)i(4)g(5)R(6)e(7)l(8)o(9)a(10)d(11)
  // lowercase 'r' matches 'R' at pos 6 — camelCase boundary bonus
  // There's no other 'r'. So this isn't a great test.
  // Better: 'c' in 'abcConfig' — should prefer C at position 3 (start of Config)
  // abcConfig: a(0)b(1)c(2)C(3)o(4)n(5)f(6)i(7)g(8)
  // 'c' matches c(2) or C(3). C(3) is a camelCase boundary — should be preferred.
  const result = assignmentScore('c', 'abcConfig')
  expect(result).not.toBeNull()
  // Position 3 (C) has a camelCase boundary bonus; position 2 (c) is mid-word
  expect(result!.positions[0]).toBe(3)
})
