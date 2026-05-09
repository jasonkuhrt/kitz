import { describe, expect, test } from 'bun:test'
import { Config, resolveConventionalCommitTypes } from './config.js'

describe('resolveConventionalCommitTypes', () => {
  test('defaults include spec-mandated types (feat=minor, fix=patch) and Angular convention (docs=patch, perf=patch)', () => {
    const result = resolveConventionalCommitTypes({})
    expect(result).toEqual({
      feat: 'minor',
      fix: 'patch',
      docs: 'patch',
      perf: 'patch',
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

  test('removes a standard type when set to null', () => {
    const result = resolveConventionalCommitTypes({ docs: null })
    expect(result['docs']).toBeUndefined()
    expect(result['feat']).toBe('minor')
    expect(result['fix']).toBe('patch')
    expect(result['perf']).toBe('patch')
  })

  test('removes multiple standard types', () => {
    const result = resolveConventionalCommitTypes({ docs: null, perf: null })
    expect(result['docs']).toBeUndefined()
    expect(result['perf']).toBeUndefined()
    expect(result['feat']).toBe('minor')
    expect(result['fix']).toBe('patch')
  })

  test('combines adding, overriding, and removing in a single config', () => {
    const result = resolveConventionalCommitTypes({
      deps: 'patch',
      feat: 'patch',
      docs: null,
    })
    expect(result).toEqual({
      feat: 'patch',
      fix: 'patch',
      perf: 'patch',
      deps: 'patch',
    })
  })

  test('setting an unknown type to null is a no-op', () => {
    const result = resolveConventionalCommitTypes({ wip: null })
    expect(result['wip']).toBeUndefined()
    expect(result).toEqual({
      feat: 'minor',
      fix: 'patch',
      docs: 'patch',
      perf: 'patch',
    })
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
