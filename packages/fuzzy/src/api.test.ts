import { Option, pipe } from 'effect'
import { expect, test } from 'vitest'
import { Fuzzy } from './_.js'

test('Fuzzy.hasMatch is accessible', () => {
  expect(Fuzzy.hasMatch('cfg', 'Config')).toBe(true)
  expect(Fuzzy.hasMatch('vdi', 'david')).toBe(true)
  expect(Fuzzy.hasMatch('cxg', 'Config')).toBe(false)
})

test('Fuzzy.score returns Option', () => {
  expect(Option.isSome(Fuzzy.score('cfg', 'Config'))).toBe(true)
  expect(Option.isNone(Fuzzy.score('cxg', 'Config'))).toBe(true)
})

test('Fuzzy.score data-last curried form works with pipe', () => {
  const result = pipe('Config', Fuzzy.score('cfg'))
  expect(Option.isSome(result)).toBe(true)
  expect(Option.getOrThrow(result)).toBe(63)
})

test('Fuzzy.positions returns positions', () => {
  const result = Fuzzy.positions('cfg', 'Config')
  expect(Option.isSome(result)).toBe(true)
  expect(Option.getOrThrow(result)).toEqual([0, 3, 5])
})

test('Fuzzy.positions data-last curried form', () => {
  const result = pipe('Config', Fuzzy.positions('cfg'))
  expect(Option.isSome(result)).toBe(true)
  expect(Option.getOrThrow(result)).toEqual([0, 3, 5])
})

test('Fuzzy.match returns scored results', () => {
  const results = Fuzzy.match([{ text: 'Config' }], 'cfg')
  expect(results).toHaveLength(1)
  expect(results[0]!.candidate.text).toBe('Config')
  expect(results[0]!.score).toBe(63)
})

test('Fuzzy.CharClass is accessible', () => {
  expect(Fuzzy.CharClass.White).toBe(0)
  expect(Fuzzy.CharClass.Lower).toBe(3)
})

test('Fuzzy.ScoreMatch is accessible', () => {
  expect(Fuzzy.ScoreMatch).toBe(16)
})
