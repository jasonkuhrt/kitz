import { describe, expect, test } from 'bun:test'
import { Config, resolveConventionalCommitTypes } from './config.js'

describe('resolveConventionalCommitTypes', () => {
  test('defaults include release-impact and no-release Angular convention types', () => {
    const result = resolveConventionalCommitTypes({})
    expect(result).toEqual({
      feat: 'minor',
      fix: 'patch',
      docs: 'patch',
      perf: 'patch',
      style: null,
      refactor: null,
      test: null,
      build: null,
      ci: null,
      chore: null,
      revert: null,
    })
  })

  test('adds a custom type with a configured bump', () => {
    const result = resolveConventionalCommitTypes({ deps: 'patch' })
    expect(result['deps']).toBe('patch')
    expect(result['feat']).toBe('minor')
  })

  test('overrides the bump level of a standard type', () => {
    const result = resolveConventionalCommitTypes({ feat: 'patch' })
    expect(result['feat']).toBe('patch')
  })

  test('marks a standard type as recognized with no release impact when set to null', () => {
    const result = resolveConventionalCommitTypes({ docs: null })
    expect(result['docs']).toBeNull()
    expect(result['feat']).toBe('minor')
    expect(result['fix']).toBe('patch')
    expect(result['perf']).toBe('patch')
  })

  test('marks multiple standard types as recognized with no release impact', () => {
    const result = resolveConventionalCommitTypes({ docs: null, perf: null })
    expect(result['docs']).toBeNull()
    expect(result['perf']).toBeNull()
    expect(result['feat']).toBe('minor')
    expect(result['fix']).toBe('patch')
  })

  test('combines adding, overriding, and no-release impacts in a single config', () => {
    const result = resolveConventionalCommitTypes({
      deps: 'patch',
      feat: 'patch',
      docs: null,
    })
    expect(result).toMatchObject({
      feat: 'patch',
      fix: 'patch',
      docs: null,
      deps: 'patch',
    })
  })

  test('setting an unknown type to null marks it as recognized with no release impact', () => {
    const result = resolveConventionalCommitTypes({ wip: null })
    expect(result['wip']).toBeNull()
    expect(result['feat']).toBe('minor')
    expect(result['fix']).toBe('patch')
  })
})

describe('release config package mappings', () => {
  test('supports explicit package path entries', () => {
    const config = Config.decodeSync({
      packages: {
        core: {
          name: '@kitz/core',
          path: './tooling/pkg-core/',
        },
      },
    })

    expect(config.packages).toEqual({
      core: {
        name: '@kitz/core',
        path: './tooling/pkg-core/',
      },
    })
  })

  test('keeps shorthand package-name entries ergonomic', () => {
    const config = Config.decodeSync({
      packages: {
        core: '@kitz/core',
      },
    })

    expect(config.packages).toEqual({
      core: '@kitz/core',
    })
  })
})

describe('release config commit overrides', () => {
  test('defaults to an empty map when omitted', () => {
    const config = Config.decodeSync({})
    expect(config.commitOverrides).toEqual({})
  })

  test('accepts a SHA-keyed changelog-text override', () => {
    const config = Config.decodeSync({
      commitOverrides: {
        abc1234: { body: 'fix(core): correct the off-by-one', reason: 'original typo' },
      },
    })

    expect(config.commitOverrides).toEqual({
      abc1234: { body: 'fix(core): correct the off-by-one', reason: 'original typo' },
    })
  })

  test('reason is optional', () => {
    const config = Config.decodeSync({
      commitOverrides: { abc1234: { body: 'reworded changelog line' } },
    })
    expect(config.commitOverrides?.['abc1234']?.body).toBe('reworded changelog line')
    expect(config.commitOverrides?.['abc1234']?.reason).toBeUndefined()
  })

  test('rejects a body carrying a breaking-change marker, naming the SHA', () => {
    expect(() =>
      Config.decodeSync({
        commitOverrides: { abc1234: { body: 'feat!: sneak in a breaking change' } },
      }),
    ).toThrow(/commit override abc1234: breaking-change content is not supported/)
  })

  test('rejects a BREAKING CHANGE footer token in the body', () => {
    expect(() =>
      Config.decodeSync({
        commitOverrides: {
          abc1234: { body: 'BREAKING-CHANGE: removed the old API' },
        },
      }),
    ).toThrow(/breaking-change content is not supported/)
  })

  test('rejects an empty body', () => {
    expect(() => Config.decodeSync({ commitOverrides: { abc1234: { body: '   ' } } })).toThrow(
      /commit override abc1234: body must not be empty/,
    )
  })

  test('rejects a multi-line body', () => {
    expect(() =>
      Config.decodeSync({
        commitOverrides: { abc1234: { body: 'line one\nline two' } },
      }),
    ).toThrow(/commit override abc1234: body must be a single line/)
  })

  test('rejects an implausibly short / non-hex SHA key', () => {
    expect(() =>
      Config.decodeSync({ commitOverrides: { 'nope!': { body: 'reworded' } } }),
    ).toThrow()
  })
})
