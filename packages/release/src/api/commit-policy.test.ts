import { ConventionalCommits } from '@kitz/conventional-commits'
import { Result } from 'effect'
import { describe, expect, test } from 'bun:test'
import { findUnknownTypes, isKnownType, validateTitle } from './commit-policy.js'
import { resolveConventionalCommitTypes } from './config.js'

// Resolved types as a repo would configure them: standard defaults + custom
// `improve` (minor) and the dotted `chore.docs` (no release impact).
const resolved = resolveConventionalCommitTypes({ improve: 'minor', 'chore.docs': null })

const parseCommit = (title: string): ConventionalCommits.Commit.Commit => {
  const result = ConventionalCommits.Title.parseEither(title)
  if (Result.isFailure(result)) throw new Error(`invalid fixture title: ${title}`)
  return result.success
}

describe('isKnownType', () => {
  test('standard angular types are known', () => {
    expect(isKnownType(ConventionalCommits.Type.parse('feat'), resolved)).toBe(true)
    expect(isKnownType(ConventionalCommits.Type.parse('chore'), resolved)).toBe(true)
  })

  test('configured custom types are known', () => {
    expect(isKnownType(ConventionalCommits.Type.parse('improve'), resolved)).toBe(true)
    expect(isKnownType(ConventionalCommits.Type.parse('chore.docs'), resolved)).toBe(true)
  })

  test('unconfigured custom types are unknown', () => {
    expect(isKnownType(ConventionalCommits.Type.parse('wip'), resolved)).toBe(false)
  })
})

describe('findUnknownTypes', () => {
  test('returns empty when every type is known (incl. multi-scope)', () => {
    expect(findUnknownTypes(parseCommit('fix(core, release): tighten'), resolved)).toEqual([])
  })

  test('returns the unknown types in first-seen order', () => {
    expect(findUnknownTypes(parseCommit('wip: experiment'), resolved).map((t) => t.value)).toEqual([
      'wip',
    ])
  })
})

describe('validateTitle', () => {
  test('accepts a simple scoped title', () => {
    expect(validateTitle('feat(core): add thing', resolved)).toEqual([])
  })

  test('accepts a comma-separated multi-scope title', () => {
    expect(validateTitle('fix(core, release): correct narrowing', resolved)).toEqual([])
  })

  test('accepts docs', () => {
    expect(validateTitle('docs: clarify rationale', resolved)).toEqual([])
  })

  test('accepts chore.docs when configured', () => {
    expect(validateTitle('chore.docs: reconcile skills table', resolved)).toEqual([])
  })

  test('reports chore.docs as unknown when not configured', () => {
    const bare = resolveConventionalCommitTypes({})
    const problems = validateTitle('chore.docs: reconcile skills table', bare)
    expect(problems).toHaveLength(1)
    expect(problems[0]?._tag).toBe('UnknownTypes')
    if (problems[0]?._tag === 'UnknownTypes') {
      expect(problems[0].types).toEqual(['chore.docs'])
    }
  })

  test('reports an unparsable title as InvalidTitle with the parse reason', () => {
    const problems = validateTitle('not a conventional commit', resolved)
    expect(problems).toHaveLength(1)
    expect(problems[0]?._tag).toBe('InvalidTitle')
    if (problems[0]?._tag === 'InvalidTitle') {
      expect(problems[0].input).toBe('not a conventional commit')
      expect(problems[0].reason.length).toBeGreaterThan(0)
    }
  })

  test('reports unknown types for a parsable-but-unrecognized title', () => {
    const problems = validateTitle('wip(core): experiment', resolved)
    expect(problems).toHaveLength(1)
    expect(problems[0]?._tag).toBe('UnknownTypes')
    if (problems[0]?._tag === 'UnknownTypes') {
      expect(problems[0].types).toEqual(['wip'])
    }
  })
})
