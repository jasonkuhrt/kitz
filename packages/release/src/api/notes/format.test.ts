import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { type CommitEntry, format } from './format.js'

const run = <A>(effect: Effect.Effect<A>) => Effect.runSync(effect)

const feat = (msg: string, hash = 'abc1234567890'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('feat'),
  message: msg,
  hash,
  breaking: false,
})

const fix = (msg: string, hash = 'def7890123456'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('fix'),
  message: msg,
  hash,
  breaking: false,
})

const perf = (msg: string, hash = 'aaa1111111111'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('perf'),
  message: msg,
  hash,
  breaking: false,
})

const docs = (msg: string, hash = 'bbb2222222222'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('docs'),
  message: msg,
  hash,
  breaking: false,
})

const custom = (msg: string, hash = 'ccc3333333333'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('improve'),
  message: msg,
  hash,
  breaking: false,
})

const breaking = (msg: string, hash = 'bbb0000000000'): CommitEntry => ({
  type: ConventionalCommits.Type.parse('feat'),
  message: msg,
  hash,
  breaking: true,
})

describe('format', () => {
  test('includes version heading', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [feat('add new API')],
        newVersion: '1.1.0',
      }),
    )
    expect(result.markdown).toContain('## @kitz/core v1.1.0')
  })

  test('groups features', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [feat('add new API'), feat('add another API', 'xyz1234567890')],
        newVersion: '1.1.0',
      }),
    )
    expect(result.markdown).toContain('### Features')
    expect(result.markdown).toContain('add new API (abc1234)')
    expect(result.markdown).toContain('add another API (xyz1234)')
    expect(result.hasBreakingChanges).toBe(false)
  })

  test('groups fixes', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [fix('fix memory leak')],
        newVersion: '1.0.1',
      }),
    )
    expect(result.markdown).toContain('### Bug Fixes')
    expect(result.markdown).toContain('fix memory leak')
  })

  test('groups breaking changes', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [breaking('redesign config API')],
        newVersion: '2.0.0',
      }),
    )
    expect(result.markdown).toContain('### Breaking Changes')
    expect(result.markdown).toContain('redesign config API')
    expect(result.hasBreakingChanges).toBe(true)
  })

  test('separates breaking from features', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [feat('add helper'), breaking('remove old API')],
        newVersion: '2.0.0',
      }),
    )
    expect(result.markdown).toContain('### Breaking Changes')
    expect(result.markdown).toContain('### Features')
    expect(result.hasBreakingChanges).toBe(true)
  })

  test('empty commits produces header only', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [],
        newVersion: '1.0.0',
      }),
    )
    expect(result.markdown).toContain('## @kitz/core v1.0.0')
    expect(result.markdown).not.toContain('###')
    expect(result.hasBreakingChanges).toBe(false)
  })

  test('truncates hash to 7 characters', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [feat('add feature', 'abc1234def5678')],
        newVersion: '1.0.0',
      }),
    )
    expect(result.markdown).toContain('(abc1234)')
    expect(result.markdown).not.toContain('abc1234d')
  })

  test('all three sections together', () => {
    const result = run(
      format({
        scope: '@kitz/core',
        commits: [
          breaking('remove deprecated API', 'bbb0000000000'),
          feat('add streaming', 'fff1111111111'),
          fix('fix race condition', 'ccc2222222222'),
        ],
        newVersion: '2.0.0',
      }),
    )
    const md = result.markdown
    const breakingIdx = md.indexOf('### Breaking Changes')
    const featuresIdx = md.indexOf('### Features')
    const fixesIdx = md.indexOf('### Bug Fixes')

    expect(breakingIdx).toBeGreaterThan(-1)
    expect(featuresIdx).toBeGreaterThan(breakingIdx)
    expect(fixesIdx).toBeGreaterThan(featuresIdx)
    expect(result.hasBreakingChanges).toBe(true)
  })

  test('renders performance, documentation, and custom change sections', () => {
    const result = run(
      format({
        scope: '@kitz/release',
        commits: [
          perf('speed up plan rendering'),
          docs('document trusted publishing'),
          custom('tighten preview UX'),
        ],
        newVersion: '0.1.1',
      }),
    )

    expect(result.markdown).toContain('### Performance')
    expect(result.markdown).toContain('speed up plan rendering')
    expect(result.markdown).toContain('### Documentation')
    expect(result.markdown).toContain('document trusted publishing')
    expect(result.markdown).toContain('### Other Changes')
    expect(result.markdown).toContain('tighten preview UX')
  })
})
