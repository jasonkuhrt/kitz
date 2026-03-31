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

test('score agrees with hasMatch — score returns None when hasMatch returns false', () => {
  // "foo bar" has a space, but "foobar" does not. hasMatch uses multiset containment
  // which will report false (space char missing). The token branch in score() must
  // not bypass this gate.
  const cases = [
    ['foo bar', 'foobar'], // space not in haystack
    ['a b', 'ab'], // same pattern
  ] as const
  for (const [needle, haystack] of cases) {
    const matched = hasMatch(needle, haystack)
    const scored = unwrap(needle, haystack)
    if (!matched) {
      expect(
        scored,
        `score('${needle}', '${haystack}') should be null when hasMatch is false`,
      ).toBeNull()
    }
  }
})

test('out-of-order matches are positive, not zero', () => {
  const result = unwrap('vdi', 'david')
  expect(result).not.toBeNull()
  expect(result!).toBeGreaterThan(0)
})
