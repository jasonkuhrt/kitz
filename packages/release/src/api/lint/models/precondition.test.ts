import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  HasDiff,
  HasGitHubAccess,
  HasOpenPR,
  HasReleasePlan,
  IsMonorepo,
  Precondition,
} from './precondition.js'

describe('Precondition variants', () => {
  test('HasOpenPR', () => {
    const p = HasOpenPR.make({})
    expect(p._tag).toBe('PreconditionHasOpenPR')
    expect(HasOpenPR.is(p)).toBe(true)
  })

  test('HasDiff', () => {
    const p = HasDiff.make({})
    expect(p._tag).toBe('PreconditionHasDiff')
    expect(HasDiff.is(p)).toBe(true)
  })

  test('IsMonorepo', () => {
    const p = IsMonorepo.make({})
    expect(p._tag).toBe('PreconditionIsMonorepo')
    expect(IsMonorepo.is(p)).toBe(true)
  })

  test('HasGitHubAccess', () => {
    const p = HasGitHubAccess.make({})
    expect(p._tag).toBe('PreconditionHasGitHubAccess')
    expect(HasGitHubAccess.is(p)).toBe(true)
  })

  test('HasReleasePlan', () => {
    const p = HasReleasePlan.make({})
    expect(p._tag).toBe('PreconditionHasReleasePlan')
    expect(HasReleasePlan.is(p)).toBe(true)
  })
})

describe('Precondition union', () => {
  test('schema roundtrip for each variant', () => {
    const variants = [
      HasOpenPR.make({}),
      HasDiff.make({}),
      IsMonorepo.make({}),
      HasGitHubAccess.make({}),
      HasReleasePlan.make({}),
    ]

    for (const v of variants) {
      const encoded = Schema.encodeSync(Precondition)(v)
      const decoded = Schema.decodeSync(Precondition)(encoded)
      expect(decoded._tag).toBe(v._tag)
    }
  })
})
