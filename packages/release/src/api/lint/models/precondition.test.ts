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
    const p = new HasOpenPR({})
    expect(p._tag).toBe('PreconditionHasOpenPR')
    expect(HasOpenPR.is(p)).toBe(true)
  })

  test('HasDiff', () => {
    const p = new HasDiff({})
    expect(p._tag).toBe('PreconditionHasDiff')
    expect(HasDiff.is(p)).toBe(true)
  })

  test('IsMonorepo', () => {
    const p = new IsMonorepo({})
    expect(p._tag).toBe('PreconditionIsMonorepo')
    expect(IsMonorepo.is(p)).toBe(true)
  })

  test('HasGitHubAccess', () => {
    const p = new HasGitHubAccess({})
    expect(p._tag).toBe('PreconditionHasGitHubAccess')
    expect(HasGitHubAccess.is(p)).toBe(true)
  })

  test('HasReleasePlan', () => {
    const p = new HasReleasePlan({})
    expect(p._tag).toBe('PreconditionHasReleasePlan')
    expect(HasReleasePlan.is(p)).toBe(true)
  })
})

describe('Precondition union', () => {
  test('schema roundtrip for each variant', () => {
    const variants = [
      new HasOpenPR({}),
      new HasDiff({}),
      new IsMonorepo({}),
      new HasGitHubAccess({}),
      new HasReleasePlan({}),
    ]

    for (const v of variants) {
      const encoded = Schema.encodeSync(Precondition)(v)
      const decoded = Schema.decodeSync(Precondition)(encoded)
      expect(decoded._tag).toBe(v._tag)
    }
  })
})
