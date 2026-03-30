import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import { match } from './match.js'

const texts = (results: ReadonlyArray<{ candidate: { text: string }; score: number }>) =>
  results.map((r) => r.candidate.text)

test('filters out non-matches', () => {
  const results = match([{ text: 'Config' }, { text: 'Close' }, { text: 'xyz' }], 'cfg')
  expect(texts(results)).not.toContain('xyz')
  expect(texts(results)).toContain('Config')
})

test('sorts by score descending', () => {
  const results = match([{ text: 'provide' }, { text: 'david' }], 'vdi')
  // david is shorter, higher coverage ratio → should rank first
  expect(results[0]!.candidate.text).toBe('david')
})

test('empty query returns all candidates with score 0', () => {
  const results = match([{ text: 'a' }, { text: 'b' }], '')
  expect(results).toHaveLength(2)
  expect(results.every((r) => r.score === 0)).toBe(true)
})

test('preserves extra candidate fields', () => {
  const results = match([{ text: 'Config', id: 'cmd-1', keybinding: 'Ctrl+R' }], 'cfg')
  expect(results[0]!.candidate.id).toBe('cmd-1')
  expect(results[0]!.candidate.keybinding).toBe('Ctrl+R')
})

test('consumer boost is folded into score', () => {
  const results = match(
    [
      { text: 'Config reload', boost: 0 },
      { text: 'Config export', boost: 50 },
    ],
    'cfg',
  )
  // Both match 'cfg'. 'Config export' has a large boost → should rank first
  expect(results[0]!.candidate.text).toBe('Config export')
})

test('includes out-of-order matches', () => {
  const results = match([{ text: 'david' }, { text: 'xyz' }], 'vdi')
  expect(texts(results)).toContain('david')
  expect(texts(results)).not.toContain('xyz')
})

test('subsequence matches rank above out-of-order matches', () => {
  // 'ab' is subsequence of 'ab', out-of-order for 'ba'
  const results = match([{ text: 'ba' }, { text: 'ab' }], 'ab')
  expect(results[0]!.candidate.text).toBe('ab')
})

test('empty candidates returns empty results', () => {
  expect(match([], 'cfg')).toEqual([])
})

test('boost on empty query shifts ordering', () => {
  const results = match(
    [
      { text: 'a', boost: 5 },
      { text: 'b', boost: 10 },
    ],
    '',
  )
  expect(results[0]!.candidate.text).toBe('b')
})
