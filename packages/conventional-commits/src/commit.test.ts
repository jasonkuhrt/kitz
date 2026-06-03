import { describe, expect, test } from 'bun:test'
import { Option } from 'effect'
import { ConventionalCommits } from './_.js'

const { Commit, Footer, Target, Type } = ConventionalCommits

const single = Commit.Single.make({
  type: Type.parse('feat'),
  scopes: ['core'],
  breaking: true,
  message: 'original subject',
  body: Option.some('a body paragraph'),
  footers: [Footer.from('Reviewed-by', 'alice')],
})

const multi = Commit.Multi.make({
  targets: [
    Target.make({ type: Type.parse('feat'), scope: 'core', breaking: false }),
    Target.make({ type: Type.parse('fix'), scope: 'cli', breaking: true }),
  ],
  message: 'original multi subject',
  summary: Option.some('a summary'),
  sections: {},
})

// ─── Commit.withDescription ───────────────────────────────────────

describe('Commit.withDescription', () => {
  test('replaces the description on a Single commit', () => {
    const next = Commit.withDescription(single, 'corrected subject')
    expect(Commit.Single.is(next)).toBe(true)
    if (!Commit.Single.is(next)) throw new Error('expected Single')
    expect(next.message).toBe('corrected subject')
  })

  test('preserves type/scopes/breaking/body/footers on a Single commit', () => {
    const next = Commit.withDescription(single, 'corrected subject')
    if (!Commit.Single.is(next)) throw new Error('expected Single')
    expect(next.type).toEqual(single.type)
    expect(next.scopes).toEqual(single.scopes)
    expect(next.breaking).toBe(single.breaking)
    expect(next.body).toEqual(single.body)
    expect(next.footers).toEqual(single.footers)
  })

  test('replaces the description on a Multi commit', () => {
    const next = Commit.withDescription(multi, 'corrected multi subject')
    expect(Commit.Multi.is(next)).toBe(true)
    if (!Commit.Multi.is(next)) throw new Error('expected Multi')
    expect(next.message).toBe('corrected multi subject')
  })

  test('preserves targets/summary/sections on a Multi commit', () => {
    const next = Commit.withDescription(multi, 'corrected multi subject')
    if (!Commit.Multi.is(next)) throw new Error('expected Multi')
    expect(next.targets).toEqual(multi.targets)
    expect(next.summary).toEqual(multi.summary)
    expect(next.sections).toEqual(multi.sections)
  })

  test('leaves the type/scope/breaking facets identical (zero-semantics)', () => {
    for (const commit of [single, multi] as const) {
      expect(Commit.facets(Commit.withDescription(commit, 'anything at all'))).toEqual(
        Commit.facets(commit),
      )
    }
  })

  test('does not mutate the input commit', () => {
    Commit.withDescription(single, 'corrected subject')
    expect(single.message).toBe('original subject')
  })
})
