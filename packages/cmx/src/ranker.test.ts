import { describe, expect, it } from 'bun:test'
import { defaultRanker } from './ranker.js'

describe('defaultRanker', () => {
  it('sorts by score descending', () => {
    const result = defaultRanker.rank([
      { choice: { token: 'a', kind: 'leaf', executable: true }, score: 1 },
      { choice: { token: 'b', kind: 'leaf', executable: true }, score: 3 },
      { choice: { token: 'c', kind: 'leaf', executable: true }, score: 2 },
    ])
    expect(result.map((c) => c.token)).toEqual(['b', 'c', 'a'])
  })

  it('uses alphabetical tiebreaker', () => {
    const result = defaultRanker.rank([
      { choice: { token: 'banana', kind: 'leaf', executable: true }, score: 5 },
      { choice: { token: 'apple', kind: 'leaf', executable: true }, score: 5 },
    ])
    expect(result.map((c) => c.token)).toEqual(['apple', 'banana'])
  })

  it('handles empty input', () => {
    expect(defaultRanker.rank([])).toEqual([])
  })

  it('handles single item', () => {
    const result = defaultRanker.rank([
      { choice: { token: 'only', kind: 'leaf', executable: true }, score: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].token).toBe('only')
  })
})
