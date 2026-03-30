import { ConventionalCommits } from '@kitz/conventional-commits'
import { describe, expect, test } from 'vitest'
import { getBump } from './version.js'

describe('getBump', () => {
  test('returns minor for feat (standard type with impact)', () => {
    const type = ConventionalCommits.Type.parse('feat')
    expect(getBump(type, false)).toBe('minor')
  })

  test('returns patch for fix (standard type with impact)', () => {
    const type = ConventionalCommits.Type.parse('fix')
    expect(getBump(type, false)).toBe('patch')
  })

  test('returns major when breaking is true regardless of type', () => {
    const type = ConventionalCommits.Type.parse('fix')
    expect(getBump(type, true)).toBe('major')
  })

  test('returns null for standard types without impact (chore, style, etc.)', () => {
    for (const value of ['chore', 'style', 'refactor', 'test', 'build', 'ci', 'revert'] as const) {
      const type = ConventionalCommits.Type.parse(value)
      expect(getBump(type, false), `expected null for '${value}'`).toBeNull()
    }
  })

  test('returns null for non-standard (custom) types', () => {
    // Custom types like "improvement", "wip", "release" are not in the Angular 11 set.
    // Before fd67640c these returned 'patch'; now they correctly return null.
    for (const value of ['improvement', 'wip', 'release', 'hotfix', 'deps']) {
      const type = ConventionalCommits.Type.parse(value)
      expect(getBump(type, false), `expected null for custom type '${value}'`).toBeNull()
    }
  })

  test('returns major for non-standard types when breaking', () => {
    // Even custom types return major when breaking — the breaking check runs first.
    const type = ConventionalCommits.Type.parse('improvement')
    expect(getBump(type, true)).toBe('major')
  })
})
