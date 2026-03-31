import { Test } from '@kitz/test'
import { Option } from 'effect'
import { expect, test } from 'vitest'
import { score } from './score.js'
import { hasMatch } from './has-match.js'

const unwrap = (needle: string, haystack: string) => {
  const result = score(needle, haystack)
  return Option.isSome(result) ? Option.getOrThrow(result) : null
}

Test.describe('score — normative golden vectors')
  .on(unwrap)
  // dprint-ignore
  .cases([['cfg', 'Config'], 63], [['cr', 'configReload'], 53], [['', 'anything'], 0])
  .test()

Test.describe('score — no match returns null')
  .on(unwrap)
  // dprint-ignore
  .cases(
    [['cxg', 'Config'], null],
    [['ll', 'reload'], null],
    [['x', ''], null],
    [['xyz', 'hello'], null],
  )
  .test()

test('out-of-order matches return a positive score', () => {
  for (const [needle, haystack] of [
    ['vdi', 'david'],
    ['ba', 'ab'],
    ['cba', 'abc'],
  ] as const) {
    const result = unwrap(needle, haystack)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0)
  }
})

test('subsequence match scores higher than out-of-order match', () => {
  const subseq = unwrap('ab', 'ab')
  const ooo = unwrap('ab', 'ba')
  expect(subseq).not.toBeNull()
  expect(ooo).not.toBeNull()
  expect(subseq!).toBeGreaterThan(ooo!)
})

test('space-containing needles match via token splitting even when hasMatch rejects the space char', () => {
  // Token match splits on spaces and matches each term independently.
  // 'config reload' → ['config', 'reload'] both exist in 'configReload'.
  // hasMatch would reject because the space char isn't in the haystack,
  // but token match runs first and succeeds.
  const result = score('config reload', 'configReload')
  expect(Option.isSome(result), `score('config reload', 'configReload') should be Some`).toBe(true)

  const result2 = score('foo bar', 'foobar')
  expect(Option.isSome(result2), `score('foo bar', 'foobar') should be Some`).toBe(true)
})

test('out-of-order matches are positive, not zero', () => {
  const result = unwrap('vdi', 'david')
  expect(result).not.toBeNull()
  expect(result!).toBeGreaterThan(0)
})
