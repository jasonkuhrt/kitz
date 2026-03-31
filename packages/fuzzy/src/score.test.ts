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

test('multi-term token match scores each term via subsequence independently', () => {
  // Each term is scored through subsequenceScore. After the optimization to
  // pre-compute haystack classification, scores must remain identical.
  const r1 = unwrap('config reload', 'config reload')
  expect(r1).not.toBeNull()
  expect(r1!).toBeGreaterThan(0)

  const r2 = unwrap('git push', 'git push origin')
  expect(r2).not.toBeNull()
  expect(r2!).toBeGreaterThan(0)

  // Reordered terms still match but with penalty
  const inOrder = unwrap('config reload', 'config reload')!
  const reordered = unwrap('reload config', 'config reload')!
  expect(inOrder).toBeGreaterThan(reordered)
})

test('token match reorder detection works for camelCase haystacks', () => {
  // For camelCase haystacks, reorder penalty should be based on which
  // camelCase word each term matches, not raw character position.
  // 'config reload' vs 'configReload': terms match in haystack word order → no penalty
  const inOrder = unwrap('config reload', 'configReload')!
  // 'reload config' vs 'configReload': terms match in reverse word order → penalty
  const reordered = unwrap('reload config', 'configReload')!
  expect(inOrder).toBeGreaterThan(reordered)

  // Same with mixed case: 'Config Reload' → configReload is in-order
  const inOrder2 = unwrap('Config Reload', 'configReload')!
  const reordered2 = unwrap('Reload Config', 'configReload')!
  expect(inOrder2).toBeGreaterThan(reordered2)

  // For space-delimited haystacks, same principle applies
  const inOrder3 = unwrap('config reload', 'config reload')!
  const reordered3 = unwrap('reload config', 'config reload')!
  expect(inOrder3).toBeGreaterThan(reordered3)
})

test('out-of-order matches are positive, not zero', () => {
  const result = unwrap('vdi', 'david')
  expect(result).not.toBeNull()
  expect(result!).toBeGreaterThan(0)
})
