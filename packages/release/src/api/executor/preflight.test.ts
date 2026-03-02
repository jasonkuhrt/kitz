import { describe, expect, test } from 'vitest'
import { PreflightError } from './preflight.js'

describe('PreflightError', () => {
  test('constructs with check and detail', () => {
    const err = new PreflightError({
      context: {
        check: 'env.npm-authenticated',
        detail: 'Not logged in to npm registry',
      },
    })
    expect(err._tag).toBe('PreflightError')
    expect(err.message).toContain('env.npm-authenticated')
    expect(err.message).toContain('Not logged in')
    expect(err.message).toContain('release lint')
  })

  test('is an Error instance', () => {
    const err = new PreflightError({
      context: { check: 'env.git-clean', detail: 'dirty working dir' },
    })
    expect(err).toBeInstanceOf(Error)
  })

  test('message includes lint investigation suggestion', () => {
    const err = new PreflightError({
      context: { check: 'plan.tags-unique', detail: 'tag exists' },
    })
    expect(err.message).toContain('--only-rule')
    expect(err.message).toContain('plan.tags-unique')
  })
})
