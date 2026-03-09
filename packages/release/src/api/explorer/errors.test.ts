import { describe, expect, test } from 'vitest'
import { ExplorerError } from './errors.js'

describe('ExplorerError', () => {
  test('constructs with detail', () => {
    const err = new ExplorerError({
      context: {
        detail: 'Invalid GITHUB_REPOSITORY format',
      },
    })
    expect(err._tag).toBe('ExplorerError')
    expect(err.message).toContain('Invalid GITHUB_REPOSITORY format')
    expect(err.message).toContain('explore release environment')
  })

  test('is an Error instance', () => {
    const err = new ExplorerError({
      context: { detail: 'test' },
    })
    expect(err).toBeInstanceOf(Error)
  })

  test('context is preserved', () => {
    const err = new ExplorerError({
      context: { detail: 'specific error detail' },
    })
    expect(err.context.detail).toBe('specific error detail')
  })
})
