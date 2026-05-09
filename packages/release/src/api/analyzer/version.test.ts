import { ConventionalCommits } from '@kitz/conventional-commits'
import { describe, expect, test } from 'bun:test'
import { resolveConventionalCommitTypes } from '../config.js'
import { getBump } from './version.js'

const defaultTypes = resolveConventionalCommitTypes({})

describe('getBump', () => {
  test('returns minor for feat using default types', () => {
    expect(getBump(ConventionalCommits.Type.parse('feat'), false, defaultTypes)).toBe('minor')
  })

  test('returns patch for fix using default types', () => {
    expect(getBump(ConventionalCommits.Type.parse('fix'), false, defaultTypes)).toBe('patch')
  })

  test('returns major when breaking regardless of type', () => {
    expect(getBump(ConventionalCommits.Type.parse('fix'), true, defaultTypes)).toBe('major')
    expect(getBump(ConventionalCommits.Type.parse('improvement'), true, defaultTypes)).toBe('major')
  })

  test('returns null for Angular convention types without impact (chore, style, etc.)', () => {
    for (const value of ['chore', 'style', 'refactor', 'test', 'build', 'ci', 'revert']) {
      expect(
        getBump(ConventionalCommits.Type.parse(value), false, defaultTypes),
        `expected null for '${value}'`,
      ).toBeNull()
    }
  })

  test('returns null for unconfigured custom types', () => {
    for (const value of ['improvement', 'wip', 'release', 'hotfix']) {
      expect(
        getBump(ConventionalCommits.Type.parse(value), false, defaultTypes),
        `expected null for '${value}'`,
      ).toBeNull()
    }
  })

  test('returns configured bump for custom types', () => {
    const types = resolveConventionalCommitTypes({ deps: 'patch', improvement: 'minor' })
    expect(getBump(ConventionalCommits.Type.parse('deps'), false, types)).toBe('patch')
    expect(getBump(ConventionalCommits.Type.parse('improvement'), false, types)).toBe('minor')
  })

  test('overrides standard type bump when config says so', () => {
    const types = resolveConventionalCommitTypes({ feat: 'patch' })
    expect(getBump(ConventionalCommits.Type.parse('feat'), false, types)).toBe('patch')
  })

  test('returns null for a removed standard type', () => {
    const types = resolveConventionalCommitTypes({ docs: null })
    expect(getBump(ConventionalCommits.Type.parse('docs'), false, types)).toBeNull()
  })
})
