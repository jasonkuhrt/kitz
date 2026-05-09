import { describe, expect, it } from 'bun:test'
import { Matcher } from './matcher.js'
import type { MatchCandidate } from './matcher.js'

const candidates: MatchCandidate[] = [
  { text: 'Config reload' },
  { text: 'Config export' },
  { text: 'Buffer close' },
]

describe('Matcher.fuzzy', () => {
  const matcher = Matcher.fuzzy()

  it('returns scored results sorted by score descending', () => {
    const results = matcher.match(candidates, 'rel')
    expect(results.length).toBeGreaterThan(0)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('empty query returns all candidates', () => {
    const results = matcher.match(candidates, '')
    expect(results).toHaveLength(candidates.length)
  })

  it('non-matching query returns empty', () => {
    const results = matcher.match(candidates, 'zzz')
    expect(results).toHaveLength(0)
  })

  it('boost increases score', () => {
    const boosted: MatchCandidate[] = [
      { text: 'alpha', boost: 10 },
      { text: 'also', boost: 0 },
    ]
    const results = matcher.match(boosted, 'al')
    expect(results.length).toBe(2)
    // The boosted candidate should rank first
    expect(results[0].candidate.text).toBe('alpha')
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('empty query respects boost ordering', () => {
    const boosted: MatchCandidate[] = [
      { text: 'low', boost: 1 },
      { text: 'high', boost: 5 },
      { text: 'mid', boost: 3 },
    ]
    const results = matcher.match(boosted, '')
    expect(results[0].candidate.text).toBe('high')
    expect(results[1].candidate.text).toBe('mid')
    expect(results[2].candidate.text).toBe('low')
  })
})

describe('Matcher.substring', () => {
  const matcher = Matcher.substring()

  it('returns scored results sorted by score descending', () => {
    const results = matcher.match(candidates, 'Config')
    expect(results.length).toBe(2) // Config reload, Config export
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('empty query returns all candidates', () => {
    const results = matcher.match(candidates, '')
    expect(results).toHaveLength(candidates.length)
  })

  it('non-matching query returns empty', () => {
    const results = matcher.match(candidates, 'zzz')
    expect(results).toHaveLength(0)
  })

  it('only matches contiguous substrings', () => {
    // "re" is contiguous in "reload" but not in "export"
    const results = matcher.match(candidates, 're')
    const texts = results.map((r) => r.candidate.text)
    expect(texts).toContain('Config reload')
    expect(texts).not.toContain('Config export')
  })

  it('prefers starts-with matches', () => {
    const items: MatchCandidate[] = [{ text: 'reload config' }, { text: 'Config reload' }]
    const results = matcher.match(items, 'Config')
    // "Config reload" starts with "Config", should rank first
    expect(results[0].candidate.text).toBe('Config reload')
  })

  it('boost is respected', () => {
    const boosted: MatchCandidate[] = [
      { text: 'alpha bet', boost: 0 },
      { text: 'alpha max', boost: 10 },
    ]
    const results = matcher.match(boosted, 'alpha')
    expect(results[0].candidate.text).toBe('alpha max')
  })
})
