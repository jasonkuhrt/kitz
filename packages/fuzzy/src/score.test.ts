import { Test } from '@kitz/test'
import { Option } from 'effect'
import { expect, test } from 'vitest'
import { score } from './score.js'

const unwrap = (needle: string, haystack: string) => {
  const result = score(needle, haystack)
  return Option.isSome(result) ? Option.getOrThrow(result) : null
}

Test.describe('score — normative golden vectors')
  .on(unwrap)
  // dprint-ignore
  .cases(
    [['cfg', 'Config'],      63],
    [['cr', 'configReload'], 53],
    [['', 'anything'],        0],
  )
  .test()

Test.describe('score — no match returns null')
  .on(unwrap)
  // dprint-ignore
  .cases(
    [['cxg', 'Config'], null],
    [['ll', 'reload'],  null],
    [['x', ''],         null],
    [['xyz', 'hello'],  null],
  )
  .test()

test('out-of-order matches return a positive score', () => {
  for (const [needle, haystack] of [['vdi', 'david'], ['ba', 'ab'], ['cba', 'abc']] as const) {
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

test('out-of-order matches are positive, not zero', () => {
  const result = unwrap('vdi', 'david')
  expect(result).not.toBeNull()
  expect(result!).toBeGreaterThan(0)
})
