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
